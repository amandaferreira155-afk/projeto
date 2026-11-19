/**
 * Sistema de Gestão e Triagem Hospitalar (script.js)
 * Autenticação Individual:
 * - Médico: login por Nome ou CRM + CPF individual como senha.
 * - Enfermeira: login por Nome ou COREN + CPF individual como senha.
 * - Paciente: login por Nome ou Protocolo + Código Aleatório individual gerado no cadastro.
 */

const PRIORIDADES = {
  1: "Vermelho - Emergência",
  2: "Amarelo - Urgente",
  3: "Verde - Pouco Urgente"
};

const $ = id => document.getElementById(id);

/** Exceção personalizada para regras de negócio, autenticação e sigilo */
class ErroHospitalar extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroHospitalar";
  }
}

/** Valida e limpa os 11 dígitos do CPF */
function normalizarCpf(cpf) {
  const digitos = String(cpf || "").replace(/\D/g, "");
  if (digitos.length !== 11 || /^(\d)\1+$/.test(digitos)) {
    throw new ErroHospitalar("CPF inválido. Informe os 11 dígitos corretamente.");
  }
  return digitos;
}

/** Gera código alfanumérico aleatório de 6 caracteres para acesso individual do paciente */
function gerarCodigoAleatorio(tamanho = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: tamanho }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Representa um paciente com código de acesso individual e sintomas encapsulados */
class Paciente {
  constructor(id, nome, idade, sintomas, prioridade) {
    if (!nome || !nome.trim()) throw new ErroHospitalar("O nome do paciente é obrigatório.");
    if (!Number.isInteger(idade) || idade < 0 || idade > 130) {
      throw new ErroHospitalar("Idade inválida. Informe um número inteiro entre 0 e 130.");
    }
    if (!sintomas || !sintomas.trim()) throw new ErroHospitalar("Descreva os sintomas do paciente.");
    if (!PRIORIDADES[prioridade]) throw new ErroHospitalar("Classificação de risco inválida.");

    this.id = id;
    this.nome = nome.trim();
    this.idade = idade;
    this._sintomas = sintomas.trim();
    this.prioridade = prioridade;
    this.status = "Aguardando";
    this.medicoResponsavel = null;
    this.diagnosticoFinal = null;
    this.codigoAcesso = gerarCodigoAleatorio();
  }

  /** Retorna sintomas apenas para médicos ou para o próprio paciente autenticado */
  obterSintomas(perfil, usuarioId = null) {
    if (perfil === "MEDICO" || (perfil === "PACIENTE" && usuarioId === this.id)) {
      return this._sintomas;
    }
    return "🔒 Sigilo médico (apenas médico)";
  }
}

/** Classe base para profissionais da saúde autenticados por CPF */
class ProfissionalSaude {
  constructor(registro, nome, cpf, tipoRegistro) {
    if (!registro || !registro.trim()) throw new ErroHospitalar(`O ${tipoRegistro} é obrigatório.`);
    if (!nome || !nome.trim()) throw new ErroHospitalar("O nome é obrigatório.");
    this.nome = nome.trim();
    this._cpf = normalizarCpf(cpf);
  }

  validarSenha(senhaInformada) {
    const limpo = String(senhaInformada || "").replace(/\D/g, "");
    return limpo.length === 11 && limpo === this._cpf;
  }
}

class Medico extends ProfissionalSaude {
  constructor(crm, nome, especialidade, cpf) {
    super(crm, nome, cpf, "CRM");
    this.crm = crm.trim().toUpperCase();
    this.especialidade = especialidade && especialidade.trim() ? especialidade.trim() : "Clínica Geral";
    this.disponivel = true;
  }
}

class Enfermeira extends ProfissionalSaude {
  constructor(coren, nome, cpf) {
    super(coren, nome, cpf, "COREN");
    this.coren = coren.trim().toUpperCase();
  }
}

/** Gerencia usuários individuais, triagem, fila por gravidade e permissões */
class Hospital {
  constructor(nome) {
    this.nome = nome;
    this.pacientes = [];
    this.medicos = [];
    this.enfermeiras = [];
    this.historicoAltas = [];
    this.contadorId = 1;
  }

  cadastrarMedico(crm, nome, especialidade, cpf, perfil = "ENFERMEIRA") {
    if (perfil === "PACIENTE") throw new ErroHospitalar("Acesso negado.");
    const crmFmt = crm.trim().toUpperCase();
    if (this.medicos.some(m => m.crm === crmFmt)) {
      throw new ErroHospitalar(`Já existe um médico cadastrado com o CRM ${crmFmt}.`);
    }
    const medico = new Medico(crm, nome, especialidade, cpf);
    this.medicos.push(medico);
    return medico;
  }

  cadastrarEnfermeira(coren, nome, cpf) {
    const corenFmt = coren.trim().toUpperCase();
    if (this.enfermeiras.some(e => e.coren === corenFmt)) {
      throw new ErroHospitalar(`Já existe uma enfermeira com COREN ${corenFmt}.`);
    }
    const enf = new Enfermeira(coren, nome, cpf);
    this.enfermeiras.push(enf);
    return enf;
  }

  registrarPaciente(nome, idade, sintomas, prioridade, perfil = "ENFERMEIRA") {
    const prioFinal = perfil === "PACIENTE" ? 3 : prioridade;
    const paciente = new Paciente(this.contadorId++, nome, idade, sintomas, prioFinal);
    this.pacientes.push(paciente);
    return paciente;
  }

  autenticar(perfil, identificador, senha) {
    const idLimpo = String(identificador || "").trim().toLowerCase();
    if (!idLimpo || !senha) throw new ErroHospitalar("Preencha sua identificação e senha.");

    if (perfil === "MEDICO") {
      const med = this.medicos.find(m => m.nome.toLowerCase() === idLimpo || m.crm.toLowerCase() === idLimpo);
      if (!med || !med.validarSenha(senha)) throw new ErroHospitalar("Médico não encontrado ou CPF incorreto.");
      return { perfil: "MEDICO", usuario: med };
    }
    if (perfil === "ENFERMEIRA") {
      const enf = this.enfermeiras.find(e => e.nome.toLowerCase() === idLimpo || e.coren.toLowerCase() === idLimpo);
      if (!enf || !enf.validarSenha(senha)) throw new ErroHospitalar("Enfermeira não encontrada ou CPF incorreto.");
      return { perfil: "ENFERMEIRA", usuario: enf };
    }
    if (perfil === "PACIENTE") {
      const numId = Number(idLimpo.replace("#", ""));
      const pac = [...this.pacientes].reverse().find(
        p => p.nome.toLowerCase() === idLimpo || (!Number.isNaN(numId) && p.id === numId)
      );
      if (!pac || pac.codigoAcesso !== String(senha).trim().toUpperCase()) {
        throw new ErroHospitalar("Paciente não encontrado ou código de acesso inválido.");
      }
      return { perfil: "PACIENTE", usuario: pac };
    }
    throw new ErroHospitalar("Perfil inválido.");
  }

  obterFilaEspera() {
    return this.pacientes
      .filter(p => p.status === "Aguardando")
      .sort((a, b) => a.prioridade - b.prioridade || a.id - b.id);
  }

  chamarProximoPaciente(perfil = "ENFERMEIRA") {
    if (perfil === "PACIENTE") throw new ErroHospitalar("Acesso negado.");
    const fila = this.obterFilaEspera();
    if (fila.length === 0) throw new ErroHospitalar("Não há pacientes aguardando na fila.");
    const medicoLivre = this.medicos.find(m => m.disponivel);
    if (!medicoLivre) throw new ErroHospitalar("Nenhum médico disponível no momento.");

    const paciente = fila[0];
    paciente.status = "Em Atendimento";
    paciente.medicoResponsavel = medicoLivre;
    medicoLivre.disponivel = false;
    return { paciente, medico: medicoLivre };
  }

  finalizarAtendimento(idPaciente, diagnostico, perfil = "MEDICO") {
    if (perfil !== "MEDICO") throw new ErroHospitalar("Apenas médicos podem registrar alta.");
    const paciente = this.pacientes.find(p => p.id === idPaciente);
    if (!paciente || paciente.status !== "Em Atendimento") {
      throw new ErroHospitalar("Paciente inválido ou não está em atendimento.");
    }
    if (paciente.medicoResponsavel) paciente.medicoResponsavel.disponivel = true;

    paciente.status = "Alta Médica";
    const nota = diagnostico && diagnostico.trim() ? diagnostico.trim() : "Alta sem observações.";
    paciente.diagnosticoFinal = nota;
    this.historicoAltas.push(`#${paciente.id} ${paciente.nome}: ${nota}`);
    return paciente;
  }
}

// --- Suíte de Testes Automatizados ---

function executarTestes() {
  const assert = (condicao, mensagem) => { if (!condicao) throw new Error(mensagem); };
  const hosp = new Hospital("Hospital Teste");

  // Teste 1: Login individual do Médico usando CPF
  hosp.cadastrarMedico("111-SC", "Ana Silva", "Emergência", "123.456.789-01", "ENFERMEIRA");
  assert(hosp.autenticar("MEDICO", "Ana Silva", "12345678901").usuario.crm === "111-SC", "Falha login médico.");

  let falhouCpf = false;
  try { hosp.autenticar("MEDICO", "111-SC", "00000000000"); } catch (e) { falhouCpf = e instanceof ErroHospitalar; }
  assert(falhouCpf, "Falha: aceitou CPF incorreto.");

  // Teste 2: Login individual da Enfermeira usando CPF
  hosp.cadastrarEnfermeira("COREN-55", "Carla Dias", "987.654.321-09");
  assert(hosp.autenticar("ENFERMEIRA", "COREN-55", "987.654.321-09").usuario.nome === "Carla Dias", "Falha login enfermeira.");

  // Teste 3: Código aleatório único por paciente e login individual
  const p1 = hosp.registrarPaciente("Carlos", 30, "Dor leve", 3, "ENFERMEIRA");
  const p2 = hosp.registrarPaciente("Mariana", 50, "Infarto agudo", 1, "ENFERMEIRA");
  assert(p1.codigoAcesso.length === 6 && p1.codigoAcesso !== p2.codigoAcesso, "Falha nos códigos únicos.");
  assert(hosp.autenticar("PACIENTE", "Mariana", p2.codigoAcesso).usuario.id === p2.id, "Falha login paciente.");

  // Teste 4: Sigilo clínico entre perfis e titularidade
  assert(
    p2.obterSintomas("ENFERMEIRA").includes("Sigilo") &&
    p2.obterSintomas("PACIENTE", p1.id).includes("Sigilo") &&
    p2.obterSintomas("PACIENTE", p2.id) === "Infarto agudo" &&
    p2.obterSintomas("MEDICO") === "Infarto agudo",
    "Falha na regra de sigilo entre usuários."
  );

  // Teste 5: Prioridade na chamada e alta exclusiva do médico
  const { paciente, medico } = hosp.chamarProximoPaciente("ENFERMEIRA");
  assert(paciente.id === p2.id && !medico.disponivel, "Falha na prioridade.");
  hosp.finalizarAtendimento(p2.id, "Estabilizada", "MEDICO");
  assert(medico.disponivel && p1.status === "Aguardando", "Falha na alta médica.");

  return "Sucesso: todos os 5 blocos de testes (login individual por CPF e código aleatório) passaram!";
}

// --- Controladores de Interface (DOM) e Inicialização ---

const hospital = new Hospital("Hospital Regional Santa Catarina");
hospital.cadastrarMedico("9876-SC", "Roberto Mendes", "Clínica Geral", "111.222.333-44", "ENFERMEIRA");
hospital.cadastrarMedico("5432-SC", "Fernanda Costa", "Cardiologia", "555.666.777-88", "ENFERMEIRA");
hospital.cadastrarEnfermeira("COREN-101", "Carla Dias", "999.888.777-66");
hospital.registrarPaciente("João Souza", 42, "Febre e dor no corpo", 3, "ENFERMEIRA");
hospital.registrarPaciente("Maria Lima", 67, "Falta de ar intensa e dor no peito", 1, "ENFERMEIRA");

let sessaoAtual = null;

function exibirMensagem(elementoId, texto, tipo = "ok") {
  const box = $(elementoId);
  box.textContent = texto;
  box.className = `alerta ${tipo}`;
}

function atualizarCamposLogin() {
  const perfil = $("loginPerfil").value;
  const ehPaciente = perfil === "PACIENTE";
  $("blocoNovoPaciente").classList.toggle("oculto", !ehPaciente);

  if (perfil === "MEDICO") {
    $("lblLoginUsuario").textContent = "Nome ou CRM *";
    $("loginUsuario").placeholder = "Ex: Roberto Mendes ou 9876-SC";
    $("lblLoginSenha").textContent = "Senha (CPF) *";
    $("loginSenha").placeholder = "Digite seu CPF";
  } else if (perfil === "ENFERMEIRA") {
    $("lblLoginUsuario").textContent = "Nome ou COREN *";
    $("loginUsuario").placeholder = "Ex: Carla Dias ou COREN-101";
    $("lblLoginSenha").textContent = "Senha (CPF) *";
    $("loginSenha").placeholder = "Digite seu CPF";
  } else {
    $("lblLoginUsuario").textContent = "Nome Completo ou Protocolo *";
    $("loginUsuario").placeholder = "Ex: Maria Lima ou 2";
    $("lblLoginSenha").textContent = "Código de Acesso *";
    $("loginSenha").placeholder = "Digite seu código individual";
  }
}

function renderizarAreaPaciente(pac) {
  const posicao = hospital.obterFilaEspera().findIndex(p => p.id === pac.id) + 1;
  const situacao = pac.status === "Aguardando"
    ? `Aguardando atendimento (${posicao}º na fila)`
    : pac.status === "Em Atendimento" && pac.medicoResponsavel
      ? `Em Atendimento com Dr(a). ${pac.medicoResponsavel.nome}`
      : pac.status;

  $("conteudoMeuAtendimento").innerHTML = `
    <div class="ficha-individual">
      <div><strong>Protocolo:</strong> #${pac.id}</div>
      <div><strong>Seu Código de Acesso (Senha):</strong> <span class="codigo-destaque">${pac.codigoAcesso}</span></div>
      <div><strong>Paciente:</strong> ${pac.nome} (${pac.idade} anos)</div>
      <div><strong>Classificação de Risco:</strong> <span class="badge p-${pac.prioridade}">${PRIORIDADES[pac.prioridade]}</span></div>
      <div><strong>Seus Sintomas Relatados:</strong> ${pac.obterSintomas("PACIENTE", pac.id)}</div>
      <div><strong>Situação Atual:</strong> ${situacao}</div>
      ${pac.diagnosticoFinal ? `<div><strong>Observação Médica:</strong> ${pac.diagnosticoFinal}</div>` : ""}
    </div>`;
}

function atualizarTela() {
  if (!sessaoAtual) return;
  const { perfil, usuario } = sessaoAtual;
  const ehMedico = perfil === "MEDICO";
  const ehPaciente = perfil === "PACIENTE";

  $("subtituloPerfil").textContent = ehMedico
    ? `🩺 Dr(a). ${usuario.nome} (CRM ${usuario.crm})`
    : perfil === "ENFERMEIRA"
      ? `💉 Enf. ${usuario.nome} (${usuario.coren})`
      : `🧑 Paciente: ${usuario.nome} (Protocolo #${usuario.id})`;

  $("layoutPrincipal").classList.toggle("modo-paciente", ehPaciente);
  ["btnChamarProximo", "colunaFormularios", "painelEquipe"].forEach(id => $(id).classList.toggle("oculto", ehPaciente));
  $("cardAreaPaciente").classList.toggle("oculto", !ehPaciente);

  if (ehPaciente) return renderizarAreaPaciente(usuario);

  const fila = hospital.obterFilaEspera();
  $("tabelaFila").innerHTML = fila.length
    ? fila.map(p => `<tr>
        <td>#${p.id}</td>
        <td><span class="codigo-destaque">${p.codigoAcesso}</span></td>
        <td><strong>${p.nome}</strong></td>
        <td>${p.idade}</td>
        <td><span class="badge p-${p.prioridade}">${PRIORIDADES[p.prioridade]}</span></td>
        <td class="${ehMedico ? "sintoma-medico" : "sigilo"}">${p.obterSintomas(perfil)}</td>
      </tr>`).join("")
    : `<tr><td colspan="6" class="sigilo">Nenhum paciente aguardando na fila.</td></tr>`;

  const emAtend = hospital.pacientes.filter(p => p.status === "Em Atendimento");
  $("tabelaAtendimento").innerHTML = emAtend.length
    ? emAtend.map(p => `<tr>
        <td>#${p.id}</td>
        <td><span class="codigo-destaque">${p.codigoAcesso}</span></td>
        <td><strong>${p.nome}</strong></td>
        <td>Dr(a). ${p.medicoResponsavel.nome}</td>
        <td><span class="badge p-${p.prioridade}">${PRIORIDADES[p.prioridade]}</span></td>
        <td class="${ehMedico ? "sintoma-medico" : "sigilo"}">${p.obterSintomas(perfil)}</td>
        <td>${ehMedico ? `<button class="btn-success btn-alta" data-id="${p.id}">Dar Alta</button>` : `<span class="sigilo">Restrito ao médico</span>`}</td>
      </tr>`).join("")
    : `<tr><td colspan="7" class="sigilo">Nenhum atendimento em andamento.</td></tr>`;

  $("tabelaMedicos").innerHTML = hospital.medicos.map(m => `<tr>
    <td>${m.crm}</td><td>Dr(a). ${m.nome}</td><td>${m.especialidade}</td>
    <td>${m.disponivel ? "🟢 Disponível" : "🔴 Em atendimento"}</td>
  </tr>`).join("");

  const livres = hospital.medicos.filter(m => m.disponivel).length;
  $("painelResumo").textContent = `Médicos Livres: ${livres}/${hospital.medicos.length} | Altas: ${hospital.historicoAltas.length}`;
}

function entrarNoSistema(sessao, mensagem) {
  sessaoAtual = sessao;
  $("erroLogin").className = "alerta";
  $("telaLogin").classList.add("oculto");
  $("telaSistema").classList.remove("oculto");
  atualizarTela();
  exibirMensagem("caixaMensagem", mensagem, "ok");
}

document.addEventListener("DOMContentLoaded", () => {
  atualizarCamposLogin();
  $("loginPerfil").addEventListener("change", atualizarCamposLogin);
  $("btnAbrirCheckin").addEventListener("click", () => $("formCheckinLogin").classList.toggle("oculto"));

  $("formLogin").addEventListener("submit", e => {
    e.preventDefault();
    try {
      const sessao = hospital.autenticar($("loginPerfil").value, $("loginUsuario").value, $("loginSenha").value);
      e.target.reset();
      atualizarCamposLogin();
      entrarNoSistema(sessao, `Bem-vindo(a), ${sessao.usuario.nome}!`);
    } catch (err) { exibirMensagem("erroLogin", err.message, "erro"); }
  });

  $("formCheckinLogin").addEventListener("submit", e => {
    e.preventDefault();
    try {
      const p = hospital.registrarPaciente($("chkNome").value, Number($("chkIdade").value), $("chkSintomas").value, 3, "PACIENTE");
      e.target.reset();
      e.target.classList.add("oculto");
      entrarNoSistema({ perfil: "PACIENTE", usuario: p }, `Check-in concluído! Anote seu código de acesso: ${p.codigoAcesso}`);
    } catch (err) { exibirMensagem("erroLogin", err.message, "erro"); }
  });

  $("btnSair").addEventListener("click", () => {
    sessaoAtual = null;
    $("telaSistema").classList.add("oculto");
    $("telaLogin").classList.remove("oculto");
  });

  $("formPaciente").addEventListener("submit", e => {
    e.preventDefault();
    try {
      const p = hospital.registrarPaciente($("pacNome").value, Number($("pacIdade").value), $("pacSintomas").value, Number($("pacPrio").value), sessaoAtual.perfil);
      e.target.reset();
      atualizarTela();
      exibirMensagem("caixaMensagem", `Paciente ${p.nome} registrado! Código de acesso individual: ${p.codigoAcesso}`, "ok");
    } catch (err) { exibirMensagem("caixaMensagem", err.message, "erro"); }
  });

  $("formMedico").addEventListener("submit", e => {
    e.preventDefault();
    try {
      const m = hospital.cadastrarMedico($("medCrm").value, $("medNome").value, $("medEsp").value, $("medCpf").value, sessaoAtual.perfil);
      e.target.reset();
      atualizarTela();
      exibirMensagem("caixaMensagem", `Dr(a). ${m.nome} (CRM ${m.crm}) cadastrado com login via CPF.`, "ok");
    } catch (err) { exibirMensagem("caixaMensagem", err.message, "erro"); }
  });

  $("btnChamarProximo").addEventListener("click", () => {
    try {
      const { paciente, medico } = hospital.chamarProximoPaciente(sessaoAtual.perfil);
      atualizarTela();
      exibirMensagem("caixaMensagem", `CHAMADA: ${paciente.nome} encaminhado(a) para Dr(a). ${medico.nome}.`, "ok");
    } catch (err) { exibirMensagem("caixaMensagem", err.message, "erro"); }
  });

  $("btnRodarTestes").addEventListener("click", () => {
    try { exibirMensagem("caixaMensagem", executarTestes(), "ok"); }
    catch (err) { exibirMensagem("caixaMensagem", err.message, "erro"); }
  });

  $("tabelaAtendimento").addEventListener("click", e => {
    if (!e.target.classList.contains("btn-alta")) return;
    const diag = prompt("Informe o diagnóstico ou observação final para alta:");
    if (diag === null) return;
    try {
      const p = hospital.finalizarAtendimento(Number(e.target.dataset.id), diag, sessaoAtual.perfil);
      atualizarTela();
      exibirMensagem("caixaMensagem", `Alta médica concluída para ${p.nome}. Médico liberado.`, "ok");
    } catch (err) { exibirMensagem("caixaMensagem", err.message, "erro"); }
  });
});