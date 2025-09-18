from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, time
import json

db = SQLAlchemy()

class DiarioPlanejamento(db.Model):
    __tablename__ = 'diario_planejamento'
    
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Date, nullable=False)
    turno = db.Column(db.String(10), nullable=False)
    equipe = db.Column(db.String(50), nullable=False)
    colaborador1 = db.Column(db.String(100), nullable=False)
    colaborador2 = db.Column(db.String(100))
    veiculo = db.Column(db.String(50))
    regiao = db.Column(db.String(100))
    
    # Relacionamento com usuário que criou o registro
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    
    # Triagem
    protocolos_prazo = db.Column(db.Integer)
    protocolos_vencidos = db.Column(db.Integer)
    total_protocolos = db.Column(db.Integer)
    comentario_triagem = db.Column(db.Text)
    status_triagem = db.Column(db.String(20))
    
    # Novas métricas solicitadas
    protocolos_nao_enviados_prazo = db.Column(db.Integer, default=0)  # Protocolos no prazo mas não enviados
    protocolos_vencem_no_turno = db.Column(db.Integer, default=0)  # Protocolos que vencem no turno atual
    
    # Execução
    atendido = db.Column(db.Integer)
    impossibilidade = db.Column(db.Integer)
    nao_executado = db.Column(db.Integer)
    comentario_execucao = db.Column(db.Text)
    eficiencia = db.Column(db.Integer)
    classificacao = db.Column(db.String(20))
    
    # Supervisão
    comentario_supervisor = db.Column(db.Text)
    sentimento_supervisao = db.Column(db.String(20))
    pontos_atencao = db.Column(db.Boolean)
    status_final = db.Column(db.String(20))
    
    # Horários operacionais
    horario_saida_base = db.Column(db.Time)
    horario_primeiro_atendimento = db.Column(db.Time)
    horario_inicio_intervalo = db.Column(db.Time)
    horario_fim_intervalo = db.Column(db.Time)
    horario_ultimo_atendimento = db.Column(db.Time)
    horario_chegada_base = db.Column(db.Time)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
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
            'created_by': self.created_by,
            
            # Triagem
            'protocolos_prazo': self.protocolos_prazo,
            'protocolos_vencidos': self.protocolos_vencidos,
            'total_protocolos': self.total_protocolos,
            'comentario_triagem': self.comentario_triagem,
            'status_triagem': self.status_triagem,
            
            # Novas métricas
            'protocolos_nao_enviados_prazo': self.protocolos_nao_enviados_prazo,
            'protocolos_vencem_no_turno': self.protocolos_vencem_no_turno,
            
            # Execução
            'atendido': self.atendido,
            'impossibilidade': self.impossibilidade,
            'nao_executado': self.nao_executado,
            'comentario_execucao': self.comentario_execucao,
            'eficiencia': self.eficiencia,
            'classificacao': self.classificacao,
            
            # Supervisão
            'comentario_supervisor': self.comentario_supervisor,
            'sentimento_supervisao': self.sentimento_supervisao,
            'pontos_atencao': self.pontos_atencao,
            'status_final': self.status_final,
            
            # Horários
            'horario_saida_base': self.horario_saida_base.isoformat() if self.horario_saida_base else None,
            'horario_primeiro_atendimento': self.horario_primeiro_atendimento.isoformat() if self.horario_primeiro_atendimento else None,
            'horario_inicio_intervalo': self.horario_inicio_intervalo.isoformat() if self.horario_inicio_intervalo else None,
            'horario_fim_intervalo': self.horario_fim_intervalo.isoformat() if self.horario_fim_intervalo else None,
            'horario_ultimo_atendimento': self.horario_ultimo_atendimento.isoformat() if self.horario_ultimo_atendimento else None,
            'horario_chegada_base': self.horario_chegada_base.isoformat() if self.horario_chegada_base else None,
            
            # Timestamps
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Protocolo(db.Model):
    """Modelo para rastrear protocolos individuais"""
    __tablename__ = 'protocolo'
    
    id = db.Column(db.Integer, primary_key=True)
    numero = db.Column(db.String(50), unique=True, nullable=False)
    descricao = db.Column(db.Text)
    
    # Relacionamento com diário
    diario_id = db.Column(db.Integer, db.ForeignKey('diario_planejamento.id'), nullable=False)
    
    # Status e prazos
    status = db.Column(db.String(20), default='pendente')  # pendente, em_andamento, concluido, vencido
    prazo_vencimento = db.Column(db.DateTime, nullable=False)
    data_envio = db.Column(db.DateTime, nullable=True)  # Quando foi enviado/finalizado
    enviado = db.Column(db.Boolean, default=False)  # Se foi enviado/finalizado
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def is_vencendo_no_turno(self, turno):
        """Verifica se o protocolo vence no turno atual"""
        agora = datetime.now()
        
        # Definir horários dos turnos
        turnos = {
            'M1': (time(6, 0), time(14, 0)),   # Manhã 1: 06:00 - 14:00
            'T2': (time(14, 0), time(22, 0)),  # Tarde 2: 14:00 - 22:00
            'N1': (time(22, 0), time(6, 0)),   # Noite 1: 22:00 - 06:00
            'A': (time(0, 0), time(23, 59))    # Administrativo: 00:00 - 23:59
        }
        
        if turno not in turnos:
            return False
            
        inicio, fim = turnos[turno]
        
        # Para turno noturno que cruza meia-noite
        if turno == 'N1':
            if agora.time() >= inicio or agora.time() <= fim:
                # Verificar se vence até o fim do turno
                if agora.time() >= inicio:
                    # Mesmo dia até 23:59
                    fim_turno = datetime.combine(agora.date(), time(23, 59))
                else:
                    # Próximo dia até 06:00
                    fim_turno = datetime.combine(agora.date(), fim)
                
                return self.prazo_vencimento <= fim_turno
        else:
            # Turnos normais
            if inicio <= agora.time() <= fim:
                fim_turno = datetime.combine(agora.date(), fim)
                return self.prazo_vencimento <= fim_turno
        
        return False
    
    def to_dict(self):
        return {
            'id': self.id,
            'numero': self.numero,
            'descricao': self.descricao,
            'diario_id': self.diario_id,
            'status': self.status,
            'prazo_vencimento': self.prazo_vencimento.isoformat() if self.prazo_vencimento else None,
            'data_envio': self.data_envio.isoformat() if self.data_envio else None,
            'enviado': self.enviado,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class RelatoriosDiarios(db.Model):
    __tablename__ = 'relatorios_diarios'
    
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Date, nullable=False)
    turno = db.Column(db.String(10), nullable=False)
    equipe = db.Column(db.String(50), nullable=False)
    relatorio_json = db.Column(db.Text, nullable=False)  # JSON string
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'data': self.data.isoformat() if self.data else None,
            'turno': self.turno,
            'equipe': self.equipe,
            'relatorio': json.loads(self.relatorio_json) if self.relatorio_json else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def set_relatorio(self, relatorio_dict):
        self.relatorio_json = json.dumps(relatorio_dict)
    
    def get_relatorio(self):
        return json.loads(self.relatorio_json) if self.relatorio_json else None

class ObservacaoSeguranca(db.Model):
    """Modelo para observações de segurança"""
    __tablename__ = 'observacao_seguranca'
    
    id = db.Column(db.Integer, primary_key=True)
    responsavel_observacao = db.Column(db.String(100), nullable=False)
    data = db.Column(db.Date, nullable=False)
    hora = db.Column(db.Time, nullable=False)
    turno = db.Column(db.String(10), nullable=False)
    equipe = db.Column(db.String(50), nullable=False)
    situacao = db.Column(db.Text, nullable=False)
    causa = db.Column(db.Text)
    acao_imediata = db.Column(db.Text)
    acao_corretiva = db.Column(db.Text)
    responsavel_acao_corretiva = db.Column(db.String(100))
    prazo_acao_corretiva = db.Column(db.Date)
    status = db.Column(db.String(20), default='aberta')  # aberta, em_andamento, concluida
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'responsavel_observacao': self.responsavel_observacao,
            'data': self.data.isoformat() if self.data else None,
            'hora': self.hora.isoformat() if self.hora else None,
            'turno': self.turno,
            'equipe': self.equipe,
            'situacao': self.situacao,
            'causa': self.causa,
            'acao_imediata': self.acao_imediata,
            'acao_corretiva': self.acao_corretiva,
            'responsavel_acao_corretiva': self.responsavel_acao_corretiva,
            'prazo_acao_corretiva': self.prazo_acao_corretiva.isoformat() if self.prazo_acao_corretiva else None,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

