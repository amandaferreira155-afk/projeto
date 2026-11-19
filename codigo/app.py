"""
Sistema de Gestão e Triagem Hospitalar (Protocolo de Prioridades)
Funcionalidades: Cadastro de médicos, triagem de pacientes por gravidade,
fila de atendimento ordenada por risco, baixa médica e testes automatizados.
"""

from datetime import datetime


# Mapa de classificação de risco (menor número = maior urgência)
PRIORIDADES = {
    1: "Vermelho - Emergência",
    2: "Amarelo - Urgente",
    3: "Verde - Pouco Urgente",
}


class ErroHospitalar(Exception):
    """Exceção personalizada para regras de negócio do hospital."""
    pass


class Paciente:
    """Representa um paciente atendido na unidade hospitalar."""

    def __init__(self, id_paciente: int, nome: str, idade: int, sintomas: str, prioridade: int):
        if not nome or not nome.strip():
            raise ErroHospitalar("O nome do paciente não pode estar vazio.")
        if not isinstance(idade, int) or idade < 0 or idade > 130:
            raise ErroHospitalar("Idade inválida. Informe um valor entre 0 e 130 anos.")
        if not sintomas or not sintomas.strip():
            raise ErroHospitalar("A descrição dos sintomas é obrigatória.")
        if prioridade not in PRIORIDADES:
            raise ErroHospitalar("Prioridade inválida. Escolha 1 (Vermelho), 2 (Amarelo) ou 3 (Verde).")

        self.id = id_paciente
        self.nome = nome.strip()
        self.idade = idade
        self.sintomas = sintomas.strip()
        self.prioridade = prioridade
        self.status = "Aguardando"
        self.hora_entrada = datetime.now().strftime("%H:%M:%S")
        self.medico_responsavel = None

    def __str__(self) -> str:
        risco = PRIORIDADES[self.prioridade]
        return f"[ID {self.id}] {self.nome} ({self.idade} anos) | Risco: {risco} | Status: {self.status}"


class Medico:
    """Representa um profissional médico disponível para atendimento."""

    def __init__(self, crm: str, nome: str, especialidade: str):
        if not crm or not crm.strip():
            raise ErroHospitalar("O CRM do médico é obrigatório.")
        if not nome or not nome.strip():
            raise ErroHospitalar("O nome do médico não pode estar vazio.")

        self.crm = crm.strip().upper()
        self.nome = nome.strip()
        self.especialidade = especialidade.strip() if especialidade.strip() else "Clínica Geral"
        self.disponivel = True

    def __str__(self) -> str:
        estado = "Disponível" if self.disponivel else "Em atendimento"
        return f"Dr(a). {self.nome} (CRM: {self.crm} - {self.especialidade}) [{estado}]"


class Hospital:
    """Gerencia o fluxo de pacientes, médicos e atendimentos."""

    def __init__(self, nome: str):
        self.nome = nome
        self.pacientes: list[Paciente] = []
        self.medicos: list[Medico] = []
        self.historico_altas: list[str] = []
        self._contador_pacientes = 1

    def cadastrar_medico(self, crm: str, nome: str, especialidade: str = "Clínica Geral") -> Medico:
        """Cadastra um médico verificando duplicidade de CRM."""
        for medico in self.medicos:
            if medico.crm == crm.strip().upper():
                raise ErroHospitalar(f"Já existe um médico cadastrado com o CRM {medico.crm}.")

        novo_medico = Medico(crm, nome, especialidade)
        self.medicos.append(novo_medico)
        return novo_medico

    def registrar_paciente(self, nome: str, idade: int, sintomas: str, prioridade: int) -> Paciente:
        """Realiza a triagem e adiciona o paciente à fila de espera."""
        paciente = Paciente(self._contador_pacientes, nome, idade, sintomas, prioridade)
        self.pacientes.append(paciente)
        self._contador_pacientes += 1
        return paciente

    def obter_fila_espera(self) -> list[Paciente]:
        """Retorna pacientes aguardando, ordenados por gravidade e ordem de chegada."""
        aguardando = [p for p in self.pacientes if p.status == "Aguardando"]
        return sorted(aguardando, key=lambda p: (p.prioridade, p.id))

    def chamar_proximo_paciente(self) -> tuple[Paciente, Medico]:
        """Aloca o paciente mais grave para o primeiro médico disponível."""
        fila = self.obter_fila_espera()
        if not fila:
            raise ErroHospitalar("Não há pacientes aguardando na fila de triagem.")

        medico_livre = next((m for m in self.medicos if m.disponivel), None)
        if not medico_livre:
            raise ErroHospitalar("Nenhum médico disponível no momento. Aguarde a liberação de um consultório.")

        paciente = fila[0]
        paciente.status = "Em Atendimento"
        paciente.medico_responsavel = medico_livre
        medico_livre.disponivel = False
        return paciente, medico_livre

    def finalizar_atendimento(self, id_paciente: int, diagnostico: str) -> Paciente:
        """Conclui o atendimento, libera o médico e registra a alta no histórico."""
        paciente = next((p for p in self.pacientes if p.id == id_paciente), None)
        if not paciente:
            raise ErroHospitalar(f"Paciente com ID {id_paciente} não encontrado.")
        if paciente.status != "Em Atendimento":
            raise ErroHospitalar(f"O paciente {paciente.nome} não está em atendimento ativo.")

        medico = paciente.medico_responsavel
        if medico:
            medico.disponivel = True

        paciente.status = "Alta Médica"
        nota = diagnostico.strip() if diagnostico.strip() else "Atendimento concluído sem observações."
        registro = (
            f"Paciente: {paciente.nome} (ID {paciente.id}) | "
            f"Médico: Dr(a). {medico.nome} | Diagnóstico: {nota}"
        )
        self.historico_altas.append(registro)
        return paciente

    def exibir_painel(self) -> None:
        """Exibe o panorama completo da unidade hospitalar."""
        print(f"\n{'=' * 60}")
        print(f"PAINEL OPERACIONAL - {self.nome.upper()}")
        print(f"{'=' * 60}")

        print("\n[1] Corpo Clínico:")
        if not self.medicos:
            print("  Nenhum médico cadastrado.")
        for m in self.medicos:
            print(f"  - {m}")

        print("\n[2] Fila de Espera (Ordenada por Prioridade):")
        fila = self.obter_fila_espera()
        if not fila:
            print("  Fila vazia.")
        for p in fila:
            print(f"  - {p} | Sintomas: {p.sintomas}")

        print("\n[3] Pacientes em Atendimento:")
        em_atendimento = [p for p in self.pacientes if p.status == "Em Atendimento"]
        if not em_atendimento:
            print("  Nenhum atendimento em curso.")
        for p in em_atendimento:
            print(f"  - {p} -> Com Dr(a). {p.medico_responsavel.nome}")

        print(f"\n[4] Total de Altas Concluídas: {len(self.historico_altas)}")
        print(f"{'=' * 60}\n")


# --- Funções Auxiliares de Validação de Entrada ---

def ler_texto_obrigatorio(mensagem: str) -> str:
    """Garante que o usuário digite um texto não vazio."""
    while True:
        valor = input(mensagem).strip()
        if valor:
            return valor
        print("Entrada inválida: este campo não pode ficar em branco.")


def ler_inteiro_valido(mensagem: str, minimo: int, maximo: int) -> int:
    """Lê um número inteiro dentro de um intervalo específico sem quebrar o programa."""
    while True:
        entrada = input(mensagem).strip()
        try:
            numero = int(entrada)
            if minimo <= numero <= maximo:
                return numero
            print(f"Valor fora do limite. Digite um número entre {minimo} e {maximo}.")
        except ValueError:
            print("Entrada inválida: digite apenas números inteiros.")


# --- Suíte de Testes Automatizados ---

def executar_testes() -> None:
    """Valida regras de negócio, ordenação por risco e rejeição de dados inválidos."""
    print("\nIniciando bateria de testes automatizados...")
    hosp_teste = Hospital("Hospital Teste")

    # Teste 1: Cadastro de médico e validação de CRM duplicado
    hosp_teste.cadastrar_medico("12345-SC", "Ana Silva", "Emergencista")
    try:
        hosp_teste.cadastrar_medico("12345-SC", "Outro Nome", "Pediatria")
        assert False, "Deveria bloquear CRM duplicado."
    except ErroHospitalar:
        pass

    # Teste 2: Triagem e ordenação por prioridade (1 deve passar à frente de 3)
    p_verde = hosp_teste.registrar_paciente("Carlos", 30, "Dor leve no braço", 3)
    p_vermelho = hosp_teste.registrar_paciente("Mariana", 55, "Dor torácica intensa", 1)

    paciente_chamado, medico_alocado = hosp_teste.chamar_proximo_paciente()
    assert paciente_chamado.id == p_vermelho.id, "Erro: paciente de emergência deveria ser chamado primeiro."
    assert not medico_alocado.disponivel, "Erro: médico deveria constar como ocupado."

    # Teste 3: Tentativa de chamar próximo sem médico livre
    try:
        hosp_teste.chamar_proximo_paciente()
        assert False, "Deveria impedir chamada sem médicos disponíveis."
    except ErroHospitalar:
        pass

    # Teste 4: Alta médica e liberação de médico
    hosp_teste.finalizar_atendimento(p_vermelho.id, "Medicação administrada, quadro estável.")
    assert medico_alocado.disponivel, "Erro: médico deveria voltar a ficar disponível após alta."
    assert p_verde.status == "Aguardando", "Erro: paciente verde ainda deveria aguardar."

    # Teste 5: Validação de entradas inválidas na criação de paciente
    entradas_invalidas = [
        ("", 25, "Febre", 2),         # Nome vazio
        ("João", -5, "Febre", 2),      # Idade negativa
        ("João", 25, "Febre", 9),      # Prioridade inexistente
    ]
    for nome, idade, sintoma, prio in entradas_invalidas:
        try:
            hosp_teste.registrar_paciente(nome, idade, sintoma, prio)
            assert False, f"Deveria rejeitar entrada inválida: {(nome, idade, prio)}"
        except ErroHospitalar:
            pass

    print("Todos os 5 blocos de teste passaram com sucesso!\n")


# --- Interface Interativa (Menu Principal) ---

def iniciar_menu() -> None:
    """Executa o loop interativo do sistema hospitalar."""
    hospital = Hospital("Hospital Regional Santa Catarina")
    # Dados iniciais para facilitar a demonstração imediata
    hospital.cadastrar_medico("9876-SC", "Roberto Mendes", "Clínica Geral")
    hospital.cadastrar_medico("5432-SC", "Fernanda Costa", "Cardiologia")

    while True:
        print("--- MENU HOSPITALAR ---")
        print("1. Cadastrar Médico")
        print("2. Registrar Paciente (Triagem)")
        print("3. Chamar Próximo Paciente para Atendimento")
        print("4. Finalizar Atendimento (Dar Alta)")
        print("5. Exibir Painel do Hospital")
        print("6. Executar Testes Automatizados")
        print("0. Sair")

        opcao = ler_inteiro_valido("Escolha uma opção: ", 0, 6)

        try:
            if opcao == 1:
                crm = ler_texto_obrigatorio("CRM do médico: ")
                nome = ler_texto_obrigatorio("Nome do médico: ")
                esp = input("Especialidade (Enter para Clínica Geral): ")
                m = hospital.cadastrar_medico(crm, nome, esp)
                print(f"Sucesso: {m} cadastrado.")

            elif opcao == 2:
                nome = ler_texto_obrigatorio("Nome do paciente: ")
                idade = ler_inteiro_valido("Idade do paciente (0-130): ", 0, 130)
                sintomas = ler_texto_obrigatorio("Sintomas relatados: ")
                print("Prioridade: [1] Vermelho (Emergência) | [2] Amarelo (Urgente) | [3] Verde (Pouco Urgente)")
                prio = ler_inteiro_valido("Classificação de risco: ", 1, 3)
                p = hospital.registrar_paciente(nome, idade, sintomas, prio)
                print(f"Paciente registrado na fila: {p}")

            elif opcao == 3:
                paciente, medico = hospital.chamar_proximo_paciente()
                print(f"CHAMADA: {paciente.nome} encaminhado(a) para Dr(a). {medico.nome}.")

            elif opcao == 4:
                id_pac = ler_inteiro_valido("ID do paciente para alta: ", 1, 99999)
                diag = input("Diagnóstico / Observação médica: ")
                paciente = hospital.finalizar_atendimento(id_pac, diag)
                print(f"Alta registrada para {paciente.nome}. Médico liberado.")

            elif opcao == 5:
                hospital.exibir_painel()

            elif opcao == 6:
                executar_testes()

            elif opcao == 0:
                print("Encerrando o sistema hospitalar.")
                break

        except ErroHospitalar as erro:
            print(f"[AVISO DO SISTEMA]: {erro}")


if __name__ == "__main__":
    iniciar_menu()