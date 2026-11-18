const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function criarElemento() {
  const listeners = {};
  return {
    value: "",
    textContent: "",
    className: "",
    hidden: false,
    disabled: false,
    children: [],
    attributes: {},
    classList: { toggle: jest.fn() },
    addEventListener(tipo, callback) {
      listeners[tipo] = callback;
    },
    disparar(tipo, evento = {}) {
      if (listeners[tipo]) listeners[tipo](evento);
    },
    appendChild(filho) {
      this.children.push(filho);
      return filho;
    },
    append(...filhos) {
      this.children.push(...filhos);
    },
    setAttribute(nome, valor) {
      this.attributes[nome] = valor;
    },
    closest() {
      return this.caixa;
    },
    focus() {
      this.foiFocado = true;
    }
  };
}

function carregarAplicacao() {
  const ids = [
    "form-cadastro", "nome", "endereco", "email", "telefone", "cargo",
    "salario", "mensagem", "corpo-tabela", "tabela", "vazio", "contador",
    "erro-nome", "erro-endereco", "erro-email", "erro-telefone",
    "erro-cargo", "erro-salario", "erro-turno"
  ];
  const elementos = Object.fromEntries(ids.map((id) => [id, criarElemento()]));
  const form = elementos["form-cadastro"];
  const botaoSalvar = criarElemento();
  const turnos = [
    Object.assign(criarElemento(), { value: "Manhã", checked: false }),
    Object.assign(criarElemento(), { value: "Tarde", checked: false })
  ];
  let turnoSelecionado = null;
  const registros = [];
  let proximoId = 1;

  form.querySelector = (seletor) => {
    if (seletor === "button[type=submit]") return botaoSalvar;
    if (seletor === 'input[name="turno"]:checked') return turnoSelecionado;
    if (seletor === 'input[name="turno"]') return turnos[0];
    return null;
  };
  form.reset = () => {
    ["nome", "endereco", "email", "telefone", "cargo"].forEach((id) => {
      elementos[id].value = "";
    });
    turnoSelecionado = null;
    turnos.forEach((radio) => { radio.checked = false; });
    form.disparar("reset");
  };

  for (const id of ids.filter((item) => item.startsWith("erro-"))) {
    elementos[id].caixa = { classList: { toggle: jest.fn() } };
  }

  const criarPedido = (operacao) => {
    const pedido = {};
    setTimeout(() => operacao(pedido), 0);
    return pedido;
  };
  const banco = {
    transaction() {
      return {
        objectStore() {
          return {
            getAll() {
              return criarPedido((pedido) => {
                pedido.result = registros.map((registro) => ({ ...registro }));
                pedido.onsuccess();
              });
            },
            add(funcionario) {
              return criarPedido((pedido) => {
                if (registros.some((registro) => registro.email === funcionario.email)) {
                  pedido.error = Object.assign(new Error("E-mail duplicado."), {
                    name: "ConstraintError"
                  });
                  pedido.onerror({ preventDefault: jest.fn() });
                  return;
                }
                pedido.result = proximoId++;
                registros.push({ ...funcionario, id: pedido.result });
                pedido.onsuccess();
              });
            },
            delete(id) {
              return criarPedido((pedido) => {
                const indice = registros.findIndex((registro) => registro.id === id);
                if (indice !== -1) registros.splice(indice, 1);
                pedido.onsuccess();
              });
            }
          };
        }
      };
    }
  };
  const indexedDB = {
    open() {
      const pedido = { result: banco };
      setTimeout(() => pedido.onsuccess(), 0);
      return pedido;
    }
  };

  const document = {
    getElementById(id) {
      if (!elementos[id]) elementos[id] = criarElemento();
      return elementos[id];
    },
    createElement: criarElemento
  };
  const contexto = vm.createContext({
    document,
    window: { indexedDB },
    indexedDB,
    confirm: jest.fn()
  });
  const codigo = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");
  vm.runInContext(codigo, contexto);

  return {
    elementos,
    botaoSalvar,
    registros,
    turnos,
    selecionarTurno(valor) {
      turnoSelecionado = turnos.find((radio) => radio.value === valor);
      turnos.forEach((radio) => {
        radio.checked = radio === turnoSelecionado;
      });
    }
  };
}

function preencherCampos(elementos, { endereco = "Rua Central, 123, Centro" } = {}) {
  elementos.nome.value = "Maria Aparecida Souza";
  elementos.endereco.value = endereco;
  elementos.email.value = "Maria.Souza@exemplo.com";
  elementos.telefone.value = "32999998888";
  elementos.telefone.disparar("input");
  elementos.cargo.value = "Operador de Caixa";
  elementos.cargo.disparar("change");
}

function enviarFormulario(elementos) {
  const evento = { preventDefault: jest.fn() };
  elementos["form-cadastro"].disparar("submit", evento);
  return evento;
}

function aguardarOperacoes() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

describe("cadastro de funcionários", () => {
  let elementos;
  let botaoSalvar;
  let registros;
  let turnos;
  let selecionarTurno;

  beforeEach(async () => {
    ({ elementos, botaoSalvar, registros, turnos, selecionarTurno } = carregarAplicacao());
    await aguardarOperacoes();
  });

  test("CT-01: cadastra funcionário com sucesso", async () => {
    preencherCampos(elementos);
    selecionarTurno("Manhã");

    enviarFormulario(elementos);
    await aguardarOperacoes();

    expect(elementos.mensagem.textContent).toBe("Funcionário cadastrado com sucesso.");
    expect(elementos.nome.value).toBe("");
    expect(String(elementos.contador.textContent)).toBe("1");
    expect(registros).toHaveLength(1);
    expect(registros[0].nome).toBe("Maria Aparecida Souza");
    expect(registros[0].email).toBe("maria.souza@exemplo.com");
    expect(botaoSalvar.disabled).toBe(false);
  });

  test("CT-02: impede envio quando o nome está vazio", async () => {
    preencherCampos(elementos);
    elementos.nome.value = "";

    enviarFormulario(elementos);
    await aguardarOperacoes();

    expect(elementos["erro-nome"].textContent).toBe("O campo Nome é obrigatório.");
    expect(registros).toHaveLength(0);
  });

  test("CT-03: rejeita e-mail em formato inválido", async () => {
    preencherCampos(elementos);
    elementos.email.value = "joao.x";

    enviarFormulario(elementos);
    await aguardarOperacoes();

    expect(elementos["erro-email"].textContent).toBe(
      "Informe um e-mail válido, como nome@exemplo.com."
    );
    expect(registros).toHaveLength(0);
  });

  test("CT-04: mantém apenas o último turno selecionado", async () => {
    const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
    const radios = [...html.matchAll(/<input\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => /\btype="radio"/.test(tag) && /\bname="turno"/.test(tag));

    expect(radios).toHaveLength(2);
    expect(radios.map((tag) => tag.match(/\bvalue="([^"]+)"/)[1])).toEqual(["Manhã", "Tarde"]);

    preencherCampos(elementos);
    selecionarTurno("Manhã");
    selecionarTurno("Tarde");

    expect(turnos.filter((radio) => radio.checked)).toHaveLength(1);
    expect(turnos.find((radio) => radio.checked).value).toBe("Tarde");

    enviarFormulario(elementos);
    await aguardarOperacoes();

    expect(registros[0].turno).toBe("Tarde");
  });

  test("CT-05: não salva salário negativo e usa o valor do cargo", async () => {
    const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
    expect(html).toMatch(/<input(?=[^>]*\bid="salario")(?=[^>]*\breadonly)[^>]*>/);

    preencherCampos(elementos);
    elementos.cargo.value = "Açougueiro";
    elementos.cargo.disparar("change");
    elementos.salario.value = "-1500";
    selecionarTurno("Manhã");

    enviarFormulario(elementos);
    await aguardarOperacoes();

    expect(registros[0].salario).toBe(2167);
    expect(elementos.mensagem.textContent).toBe("Funcionário cadastrado com sucesso.");
  });

  test("CT-06: impede envio quando o endereço está vazio", async () => {
    preencherCampos(elementos, { endereco: "" });
    selecionarTurno("Manhã");

    enviarFormulario(elementos);
    await aguardarOperacoes();

    expect(elementos["erro-endereco"].textContent).toBe("O campo Endereço é obrigatório.");
    expect(registros).toHaveLength(0);
  });

  test("CT-07: rejeita telefone curto e mascara dígitos em texto", async () => {
    preencherCampos(elementos);
    selecionarTurno("Manhã");
    elementos.telefone.value = "3299";
    elementos.telefone.disparar("input");

    enviarFormulario(elementos);
    await aguardarOperacoes();

    expect(elementos["erro-telefone"].textContent).toBe("Informe o telefone com DDD.");
    expect(registros).toHaveLength(0);

    elementos.telefone.value = "abc32999998888xyz";
    elementos.telefone.disparar("input");
    expect(elementos.telefone.value).toBe("(32) 99999-8888");

    enviarFormulario(elementos);
    await aguardarOperacoes();

    expect(registros).toHaveLength(1);
    expect(registros[0].telefone).toBe("(32) 99999-8888");
  });

  test("CT-08: impede envio quando nenhum cargo foi selecionado", async () => {
    preencherCampos(elementos);
    elementos.cargo.value = "";
    selecionarTurno("Manhã");

    enviarFormulario(elementos);
    await aguardarOperacoes();

    expect(elementos["erro-cargo"].textContent).toBe("O campo Cargo é obrigatório.");
    expect(registros).toHaveLength(0);
  });

  test("CT-09: impede envio quando nenhum turno foi selecionado", async () => {
    preencherCampos(elementos);

    enviarFormulario(elementos);
    await aguardarOperacoes();

    expect(elementos["erro-turno"].textContent).toBe(
      "O campo Turno é obrigatório. Escolha manhã ou tarde."
    );
    expect(registros).toHaveLength(0);
  });

  test("CT-10: mostra o salário correspondente a cada cargo", () => {
    const salarios = [
      ["Operador de Caixa", "R$\u00a01.913,00"],
      ["Repositor de Mercadorias", "R$\u00a01.889,00"],
      ["Açougueiro", "R$\u00a02.167,00"],
      ["Estoquista", "R$\u00a02.004,00"]
    ];

    salarios.forEach(([cargo, salario]) => {
      elementos.cargo.value = cargo;
      elementos.cargo.disparar("change");
      expect(elementos.salario.value).toBe(salario);
    });
  });
});
