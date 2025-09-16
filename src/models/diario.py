from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
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
    
    # Triagem
    protocolos_prazo = db.Column(db.Integer)
    protocolos_vencidos = db.Column(db.Integer)
    total_protocolos = db.Column(db.Integer)
    comentario_triagem = db.Column(db.Text)
    status_triagem = db.Column(db.String(20))
    
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
            'protocolos_prazo': self.protocolos_prazo,
            'protocolos_vencidos': self.protocolos_vencidos,
            'total_protocolos': self.total_protocolos,
            'comentario_triagem': self.comentario_triagem,
            'status_triagem': self.status_triagem,
            'atendido': self.atendido,
            'impossibilidade': self.impossibilidade,
            'nao_executado': self.nao_executado,
            'comentario_execucao': self.comentario_execucao,
            'eficiencia': self.eficiencia,
            'classificacao': self.classificacao,
            'comentario_supervisor': self.comentario_supervisor,
            'sentimento_supervisao': self.sentimento_supervisao,
            'pontos_atencao': self.pontos_atencao,
            'status_final': self.status_final,
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

