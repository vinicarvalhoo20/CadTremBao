/* =====================================================
   Trem Bão Supermercados - Cadastro de Funcionários
   Banco de dados: IndexedDB (banco real do navegador)
   ===================================================== */

/* ---------- Cargos pré-cadastrados ---------- */
const CARGOS = [
  { nome: "Operador de Caixa", salario: 1913.00 },
  { nome: "Repositor de Mercadorias", salario: 1889.00 },
  { nome: "Açougueiro", salario: 2167.00 },
  { nome: "Estoquista", salario: 2004.00 }
];

const formatarMoeda = (valor) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

/* ---------- Banco de dados (IndexedDB) ---------- */
const NOME_BANCO = "trem_bao_db";
const NOME_TABELA = "funcionarios";
let banco = null;

function abrirBanco() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Este navegador não oferece suporte a banco de dados local."));
      return;
    }
    const pedido = indexedDB.open(NOME_BANCO, 1);

    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      const tabela = db.createObjectStore(NOME_TABELA, { keyPath: "id", autoIncrement: true });
      tabela.createIndex("email", "email", { unique: true });
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

function salvarFuncionario(funcionario) {
  return new Promise((resolve, reject) => {
    const transacao = banco.transaction(NOME_TABELA, "readwrite");
    const pedido = transacao.objectStore(NOME_TABELA).add(funcionario);
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = (e) => { e.preventDefault(); reject(pedido.error); };
  });
}

function listarFuncionarios() {
  return new Promise((resolve, reject) => {
    const pedido = banco.transaction(NOME_TABELA, "readonly").objectStore(NOME_TABELA).getAll();
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

function excluirFuncionario(id) {
  return new Promise((resolve, reject) => {
    const pedido = banco.transaction(NOME_TABELA, "readwrite").objectStore(NOME_TABELA).delete(id);
    pedido.onsuccess = () => resolve();
    pedido.onerror = () => reject(pedido.error);
  });
}

/* ---------- Elementos ---------- */
const form = document.getElementById("form-cadastro");
const campoNome = document.getElementById("nome");
const campoEndereco = document.getElementById("endereco");
const campoEmail = document.getElementById("email");
const campoTelefone = document.getElementById("telefone");
const campoCargo = document.getElementById("cargo");
const campoSalario = document.getElementById("salario");
const mensagem = document.getElementById("mensagem");
const corpoTabela = document.getElementById("corpo-tabela");
const tabela = document.getElementById("tabela");
const vazio = document.getElementById("vazio");
const contador = document.getElementById("contador");

/* ---------- Cargos dinâmicos no select ---------- */
CARGOS.forEach((cargo) => {
  const opcao = document.createElement("option");
  opcao.value = cargo.nome;
  opcao.textContent = cargo.nome;
  campoCargo.appendChild(opcao);
});

campoCargo.addEventListener("change", () => {
  const cargo = CARGOS.find((c) => c.nome === campoCargo.value);
  campoSalario.value = cargo ? formatarMoeda(cargo.salario) : "";
});

/* ---------- Máscara de telefone ---------- */
campoTelefone.addEventListener("input", () => {
  let n = campoTelefone.value.replace(/\D/g, "").slice(0, 11);
  if (n.length > 10) {
    n = n.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
  } else if (n.length > 6) {
    n = n.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
  } else if (n.length > 2) {
    n = n.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
  } else if (n.length > 0) {
    n = n.replace(/^(\d*)/, "($1");
  }
  campoTelefone.value = n;
});

/* ---------- Validação ---------- */
function mostrarErro(idCampo, texto) {
  const erro = document.getElementById("erro-" + idCampo);
  erro.textContent = texto;
  const caixa = erro.closest(".campo");
  if (caixa) caixa.classList.toggle("invalido", texto !== "");
}

function validar() {
  let valido = true;
  let primeiroInvalido = null;

  const falhou = (idCampo, texto, elemento) => {
    mostrarErro(idCampo, texto);
    if (texto) {
      valido = false;
      if (!primeiroInvalido) primeiroInvalido = elemento;
    }
  };

  const nome = campoNome.value.trim().replace(/\s+/g, " ");
  let erroNome = "";
  if (nome === "") erroNome = "O campo Nome é obrigatório.";
  else if (!/^[\p{L}][\p{L}'. -]*$/u.test(nome)) erroNome = "O nome deve conter apenas letras.";
  else if (nome.split(" ").length < 2) erroNome = "Informe o nome completo (nome e sobrenome).";
  falhou("nome", erroNome, campoNome);

  const endereco = campoEndereco.value.trim();
  let erroEndereco = "";
  if (endereco === "") erroEndereco = "O campo Endereço é obrigatório.";
  else if (endereco.length < 8) erroEndereco = "Informe o endereço com rua, número e bairro.";
  falhou("endereco", erroEndereco, campoEndereco);

  const email = campoEmail.value.trim();
  let erroEmail = "";
  if (email === "") erroEmail = "O campo E-mail é obrigatório.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) erroEmail = "Informe um e-mail válido, como nome@exemplo.com.";
  falhou("email", erroEmail, campoEmail);

  const digitos = campoTelefone.value.replace(/\D/g, "");
  let erroTelefone = "";
  if (digitos === "") erroTelefone = "O campo Telefone é obrigatório.";
  else if (digitos.length < 10 || digitos.length > 11) erroTelefone = "Informe o telefone com DDD.";
  falhou("telefone", erroTelefone, campoTelefone);

  falhou("cargo",
    !campoCargo.value ? "O campo Cargo é obrigatório." : "",
    campoCargo);

  const cargoEscolhido = CARGOS.find((c) => c.nome === campoCargo.value);
  falhou("salario",
    campoCargo.value && !(cargoEscolhido && cargoEscolhido.salario > 0)
      ? "O salário deve ser maior que zero." : "",
    campoCargo);

  const turno = form.querySelector('input[name="turno"]:checked');
  falhou("turno",
    !turno ? "O campo Turno é obrigatório. Escolha manhã ou tarde." : "",
    form.querySelector('input[name="turno"]'));

  if (primeiroInvalido) primeiroInvalido.focus();
  return valido;
}

function limparErros() {
  ["nome", "endereco", "email", "telefone", "cargo", "salario", "turno"].forEach((id) => mostrarErro(id, ""));
}

/* ---------- Mensagens ---------- */
function avisar(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.className = "mensagem " + (texto ? tipo : "");
}

/* ---------- Lista na tela ---------- */
async function atualizarLista() {
  const funcionarios = await listarFuncionarios();
  corpoTabela.textContent = "";

  funcionarios
    .sort((a, b) => b.id - a.id)
    .forEach((f) => {
      const linha = document.createElement("tr");

      const tdNome = document.createElement("td");
      tdNome.className = "nome";
      tdNome.textContent = f.nome;
      const detalhe = document.createElement("small");
      detalhe.textContent = f.email + " · " + f.telefone;
      tdNome.appendChild(detalhe);

      const tdCargo = document.createElement("td");
      tdCargo.textContent = f.cargo;

      const tdTurno = document.createElement("td");
      tdTurno.textContent = f.turno;

      const tdSalario = document.createElement("td");
      tdSalario.className = "valor";
      tdSalario.textContent = formatarMoeda(f.salario);

      const tdAcao = document.createElement("td");
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "btn-excluir";
      botao.textContent = "Excluir";
      botao.setAttribute("aria-label", "Excluir cadastro de " + f.nome);
      botao.addEventListener("click", async () => {
        if (confirm("Excluir o cadastro de " + f.nome + "?")) {
          await excluirFuncionario(f.id);
          await atualizarLista();
          avisar("Cadastro de " + f.nome + " excluído.", "ok");
        }
      });
      tdAcao.appendChild(botao);

      linha.append(tdNome, tdCargo, tdTurno, tdSalario, tdAcao);
      corpoTabela.appendChild(linha);
    });

  contador.textContent = funcionarios.length;
  tabela.hidden = funcionarios.length === 0;
  vazio.hidden = funcionarios.length !== 0;
}

/* ---------- Envio do formulário ---------- */
let salvando = false;
const botaoSalvar = form.querySelector("button[type=submit]");

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (salvando) return; // evita envio duplicado com clique duplo
  avisar("", "");

  if (!validar()) return;
  salvando = true;
  botaoSalvar.disabled = true;

  const cargo = CARGOS.find((c) => c.nome === campoCargo.value);
  const funcionario = {
    nome: campoNome.value.trim().replace(/\s+/g, " "),
    endereco: campoEndereco.value.trim(),
    email: campoEmail.value.trim().toLowerCase(),
    telefone: campoTelefone.value,
    cargo: cargo.nome,
    salario: cargo.salario,
    turno: form.querySelector('input[name="turno"]:checked').value,
    cadastradoEm: new Date().toISOString()
  };

  try {
    await salvarFuncionario(funcionario);
    form.reset();
    campoSalario.value = "";
    limparErros();
    await atualizarLista();
    avisar("Funcionário cadastrado com sucesso.", "ok");
  } catch (erro) {
    if (erro && erro.name === "ConstraintError") {
      mostrarErro("email", "Já existe um funcionário com este e-mail.");
      campoEmail.focus();
      avisar("Não foi possível salvar: e-mail já cadastrado.", "falha");
    } else {
      avisar("Não foi possível salvar o cadastro. Tente novamente.", "falha");
    }
  } finally {
    salvando = false;
    botaoSalvar.disabled = false;
  }
});

form.addEventListener("reset", () => {
  limparErros();
  avisar("", "");
  campoSalario.value = "";
});

/* ---------- Início ---------- */
abrirBanco()
  .then((db) => {
    banco = db;
    return atualizarLista();
  })
  .catch((erro) => {
    avisar("Banco de dados indisponível: " + erro.message, "falha");
  });