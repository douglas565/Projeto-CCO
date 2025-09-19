from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, time
import json
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

# Modelo base para usuários
class User(db.Model):
    __tablename__ = 'user'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relacionamentos
    profile_id = db.Column(db.Integer, db.ForeignKey('profile.id'), nullable=True)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    profile = db.relationship('Profile', backref='users')
    team = db.relationship('Team', foreign_keys=[team_id], backref='members')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'is_active': self.is_active,
            'profile': self.profile.name if self.profile else None,
            'team': self.team.name if self.team else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Profile(db.Model):
    __tablename__ = 'profile'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text)
    permissions = db.Column(db.Text)  # JSON string com permissões
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'permissions': json.loads(self.permissions) if self.permissions else []
        }

class Team(db.Model):
    __tablename__ = 'team'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    supervisor_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    
    # Relacionamento com supervisor
    supervisor = db.relationship('User', foreign_keys=[supervisor_id], backref='supervised_teams')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'supervisor_id': self.supervisor_id
        }

# SHEET 1: Diário de Planejamento de Execução (Funcionários em Campo)
class DiarioPlanejamentoExecucao(db.Model):
    """Modelo baseado na sheet 'Planejamento e Execução' - Para funcionários em campo"""
    __tablename__ = 'diario_planejamento_execucao'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Informações básicas
    data = db.Column(db.Date, nullable=False)
    turno = db.Column(db.String(10), nullable=False)  # M1, T1, T2, N1, A
    equipe = db.Column(db.String(50), nullable=False)
    colaborador1 = db.Column(db.String(100), nullable=False)
    colaborador2 = db.Column(db.String(100))
    veiculo = db.Column(db.String(50))
    regiao = db.Column(db.String(100))
    
    # Horários operacionais
    horario_saida_base = db.Column(db.Time)
    horario_primeiro_atendimento = db.Column(db.Time)
    horario_inicio_intervalo = db.Column(db.Time)
    horario_fim_intervalo = db.Column(db.Time)
    horario_ultimo_atendimento = db.Column(db.Time)
    horario_chegada_base = db.Column(db.Time)
    
    # Protocolos e OS
    protocolos_recebidos = db.Column(db.Integer, default=0)
    protocolos_executados = db.Column(db.Integer, default=0)
    protocolos_pendentes = db.Column(db.Integer, default=0)
    protocolos_impossibilidade = db.Column(db.Integer, default=0)
    
    # Observações do campo
    observacoes_campo = db.Column(db.Text)
    dificuldades_encontradas = db.Column(db.Text)
    materiais_utilizados = db.Column(db.Text)
    
    # Status e controle
    status = db.Column(db.String(20), default='em_andamento')  # em_andamento, finalizado, aprovado
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    creator = db.relationship('User', backref='diarios_execucao')
    protocolos = db.relationship('ProtocoloExecucao', backref='diario', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'data': self.data.isoformat() if self.data else None,
            'turno': self.turno,
            'equipe': self.equipe,
            'colaborador1': self.colaborador1,
            'colaborador2': self.colaborador2,
            'veiculo': self.veiculo,
            'regiao': self.regiao,
            'horario_saida_base': self.horario_saida_base.isoformat() if self.horario_saida_base else None,
            'horario_primeiro_atendimento': self.horario_primeiro_atendimento.isoformat() if self.horario_primeiro_atendimento else None,
            'horario_inicio_intervalo': self.horario_inicio_intervalo.isoformat() if self.horario_inicio_intervalo else None,
            'horario_fim_intervalo': self.horario_fim_intervalo.isoformat() if self.horario_fim_intervalo else None,
            'horario_ultimo_atendimento': self.horario_ultimo_atendimento.isoformat() if self.horario_ultimo_atendimento else None,
            'horario_chegada_base': self.horario_chegada_base.isoformat() if self.horario_chegada_base else None,
            'protocolos_recebidos': self.protocolos_recebidos,
            'protocolos_executados': self.protocolos_executados,
            'protocolos_pendentes': self.protocolos_pendentes,
            'protocolos_impossibilidade': self.protocolos_impossibilidade,
            'observacoes_campo': self.observacoes_campo,
            'dificuldades_encontradas': self.dificuldades_encontradas,
            'materiais_utilizados': self.materiais_utilizados,
            'status': self.status,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class ProtocoloExecucao(db.Model):
    """Protocolos individuais para o diário de execução"""
    __tablename__ = 'protocolo_execucao'
    
    id = db.Column(db.Integer, primary_key=True)
    numero_protocolo = db.Column(db.String(50), nullable=False)
    numero_os = db.Column(db.String(50))
    tipo_servico = db.Column(db.String(100))
    endereco = db.Column(db.Text)
    cliente = db.Column(db.String(200))
    
    # Status de execução
    status = db.Column(db.String(20), default='pendente')  # pendente, executado, impossibilidade
    horario_inicio = db.Column(db.Time)
    horario_fim = db.Column(db.Time)
    observacoes = db.Column(db.Text)
    motivo_impossibilidade = db.Column(db.Text)
    
    # Relacionamento
    diario_id = db.Column(db.Integer, db.ForeignKey('diario_planejamento_execucao.id'), nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'numero_protocolo': self.numero_protocolo,
            'numero_os': self.numero_os,
            'tipo_servico': self.tipo_servico,
            'endereco': self.endereco,
            'cliente': self.cliente,
            'status': self.status,
            'horario_inicio': self.horario_inicio.isoformat() if self.horario_inicio else None,
            'horario_fim': self.horario_fim.isoformat() if self.horario_fim else None,
            'observacoes': self.observacoes,
            'motivo_impossibilidade': self.motivo_impossibilidade,
            'diario_id': self.diario_id
        }

# SHEET 2: Diário de Acompanhamento (Supervisor)
class DiarioAcompanhamento(db.Model):
    """Modelo baseado na sheet 'Acompanhamento' - Para supervisores"""
    __tablename__ = 'diario_acompanhamento'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Informações básicas
    data = db.Column(db.Date, nullable=False)
    turno = db.Column(db.String(10), nullable=False)
    supervisor = db.Column(db.String(100), nullable=False)
    
    # Referência ao diário de execução
    diario_execucao_id = db.Column(db.Integer, db.ForeignKey('diario_planejamento_execucao.id'))
    
    # Análise do supervisor
    analise_geral = db.Column(db.String(20))  # Conforme, Não conforme
    pontos_atencao = db.Column(db.Text)
    observacoes_supervisor = db.Column(db.Text)
    
    # Métricas de acompanhamento
    total_equipes_ativas = db.Column(db.Integer, default=0)
    total_protocolos_dia = db.Column(db.Integer, default=0)
    total_executados = db.Column(db.Integer, default=0)
    total_pendentes = db.Column(db.Integer, default=0)
    total_impossibilidades = db.Column(db.Integer, default=0)
    
    # Eficiência e qualidade
    percentual_eficiencia = db.Column(db.Float)
    qualidade_execucao = db.Column(db.String(20))  # Excelente, Boa, Regular, Ruim
    
    # Ações corretivas
    acoes_corretivas = db.Column(db.Text)
    prazo_acoes = db.Column(db.Date)
    responsavel_acoes = db.Column(db.String(100))
    
    # Status
    status = db.Column(db.String(20), default='em_analise')  # em_analise, aprovado, rejeitado
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    creator = db.relationship('User', backref='diarios_acompanhamento')
    diario_execucao = db.relationship('DiarioPlanejamentoExecucao', backref='acompanhamentos')
    
    def to_dict(self):
        return {
            'id': self.id,
            'data': self.data.isoformat() if self.data else None,
            'turno': self.turno,
            'supervisor': self.supervisor,
            'diario_execucao_id': self.diario_execucao_id,
            'analise_geral': self.analise_geral,
            'pontos_atencao': self.pontos_atencao,
            'observacoes_supervisor': self.observacoes_supervisor,
            'total_equipes_ativas': self.total_equipes_ativas,
            'total_protocolos_dia': self.total_protocolos_dia,
            'total_executados': self.total_executados,
            'total_pendentes': self.total_pendentes,
            'total_impossibilidades': self.total_impossibilidades,
            'percentual_eficiencia': self.percentual_eficiencia,
            'qualidade_execucao': self.qualidade_execucao,
            'acoes_corretivas': self.acoes_corretivas,
            'prazo_acoes': self.prazo_acoes.isoformat() if self.prazo_acoes else None,
            'responsavel_acoes': self.responsavel_acoes,
            'status': self.status,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# SHEET 3: Report de Falhas Operacionais (Supervisor)
class ReportFalhasOperacionais(db.Model):
    """Modelo baseado na sheet 'Report' - Para acompanhamento de falhas operacionais"""
    __tablename__ = 'report_falhas_operacionais'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Informações básicas
    data_ocorrencia = db.Column(db.Date, nullable=False)
    turno = db.Column(db.String(10), nullable=False)
    equipe_envolvida = db.Column(db.String(50))
    responsavel_report = db.Column(db.String(100), nullable=False)
    
    # Classificação da falha
    tipo_falha = db.Column(db.String(50))  # Operacional, Técnica, Comunicação, etc.
    severidade = db.Column(db.String(20))  # Baixa, Média, Alta, Crítica
    categoria = db.Column(db.String(50))  # Equipamento, Processo, Pessoal, etc.
    
    # Descrição da falha
    descricao_falha = db.Column(db.Text, nullable=False)
    causa_raiz = db.Column(db.Text)
    impacto_operacional = db.Column(db.Text)
    
    # Ações tomadas
    acao_imediata = db.Column(db.Text)
    acao_corretiva = db.Column(db.Text)
    acao_preventiva = db.Column(db.Text)
    
    # Responsabilidades e prazos
    responsavel_acao = db.Column(db.String(100))
    prazo_conclusao = db.Column(db.Date)
    data_conclusao = db.Column(db.Date)
    
    # Status e acompanhamento
    status = db.Column(db.String(20), default='aberto')  # aberto, em_andamento, concluido, cancelado
    eficacia_acao = db.Column(db.String(20))  # Eficaz, Parcialmente eficaz, Ineficaz
    
    # Custos (se aplicável)
    custo_estimado = db.Column(db.Float)
    custo_real = db.Column(db.Float)
    
    # Anexos e evidências
    evidencias = db.Column(db.Text)  # JSON com paths dos arquivos
    fotos_anexadas = db.Column(db.Boolean, default=False)
    
    # Controle
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    approved_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    creator = db.relationship('User', foreign_keys=[created_by], backref='reports_criados')
    approver = db.relationship('User', foreign_keys=[approved_by], backref='reports_aprovados')
    
    def to_dict(self):
        return {
            'id': self.id,
            'data_ocorrencia': self.data_ocorrencia.isoformat() if self.data_ocorrencia else None,
            'turno': self.turno,
            'equipe_envolvida': self.equipe_envolvida,
            'responsavel_report': self.responsavel_report,
            'tipo_falha': self.tipo_falha,
            'severidade': self.severidade,
            'categoria': self.categoria,
            'descricao_falha': self.descricao_falha,
            'causa_raiz': self.causa_raiz,
            'impacto_operacional': self.impacto_operacional,
            'acao_imediata': self.acao_imediata,
            'acao_corretiva': self.acao_corretiva,
            'acao_preventiva': self.acao_preventiva,
            'responsavel_acao': self.responsavel_acao,
            'prazo_conclusao': self.prazo_conclusao.isoformat() if self.prazo_conclusao else None,
            'data_conclusao': self.data_conclusao.isoformat() if self.data_conclusao else None,
            'status': self.status,
            'eficacia_acao': self.eficacia_acao,
            'custo_estimado': self.custo_estimado,
            'custo_real': self.custo_real,
            'evidencias': json.loads(self.evidencias) if self.evidencias else [],
            'fotos_anexadas': self.fotos_anexadas,
            'created_by': self.created_by,
            'approved_by': self.approved_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# Modelo auxiliar para controle de CCO
class ControleCCO(db.Model):
    """Modelo baseado na sheet 'auxiliar' - Para controle do CCO"""
    __tablename__ = 'controle_cco'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Informações do CCO
    cco_responsavel = db.Column(db.String(100), nullable=False)
    turno = db.Column(db.String(10), nullable=False)
    data_controle = db.Column(db.Date, nullable=False)
    
    # Horários de controle
    horario_inicio = db.Column(db.Time)
    horario_fim = db.Column(db.Time)
    
    # Equipe monitorada
    equipe = db.Column(db.String(50), nullable=False)
    
    # Análise do CCO
    analise = db.Column(db.String(20))  # Conforme, Não conforme
    status = db.Column(db.String(20))  # Pendente, Em andamento, Concluído
    observacoes_cco = db.Column(db.Text)
    
    # Controle
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    creator = db.relationship('User', backref='controles_cco')
    
    def to_dict(self):
        return {
            'id': self.id,
            'cco_responsavel': self.cco_responsavel,
            'turno': self.turno,
            'data_controle': self.data_controle.isoformat() if self.data_controle else None,
            'horario_inicio': self.horario_inicio.isoformat() if self.horario_inicio else None,
            'horario_fim': self.horario_fim.isoformat() if self.horario_fim else None,
            'equipe': self.equipe,
            'analise': self.analise,
            'status': self.status,
            'observacoes_cco': self.observacoes_cco,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# Modelo para logs de sistema
class LogSistema(db.Model):
    """Logs de ações do sistema"""
    __tablename__ = 'log_sistema'
    
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    acao = db.Column(db.String(100), nullable=False)
    tabela_afetada = db.Column(db.String(50))
    registro_id = db.Column(db.Integer)
    dados_anteriores = db.Column(db.Text)  # JSON
    dados_novos = db.Column(db.Text)  # JSON
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    usuario = db.relationship('User', backref='logs')
    
    def to_dict(self):
        return {
            'id': self.id,
            'usuario_id': self.usuario_id,
            'acao': self.acao,
            'tabela_afetada': self.tabela_afetada,
            'registro_id': self.registro_id,
            'dados_anteriores': json.loads(self.dados_anteriores) if self.dados_anteriores else None,
            'dados_novos': json.loads(self.dados_novos) if self.dados_novos else None,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }

