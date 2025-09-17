from flask import Blueprint, request, jsonify
from datetime import datetime, date
from src.models.diario import db, DiarioPlanejamento, RelatoriosDiarios
import json
from flask_jwt_extended import jwt_required, get_jwt_identity


diario_bp = Blueprint('diario', __name__)

@diario_bp.route('/planejamento', methods=['POST'])
@jwt_required()

def criar_planejamento():
    """Criar novo registro de planejamento"""
    try:
        data = request.get_json()
        
        # Validar campos obrigatórios
        required_fields = ['data', 'turno', 'equipe', 'colaborador1']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Campo obrigatório: {field}'}), 400
        
        # Converter string de data para objeto date
        data_obj = datetime.strptime(data['data'], '%Y-%m-%d').date()
        
        # Verificar se já existe registro para esta data/turno/equipe
        existing = DiarioPlanejamento.query.filter_by(
            data=data_obj,
            turno=data['turno'],
            equipe=data['equipe']
        ).first()
        
        if existing:
            return jsonify({'error': 'Já existe um registro para esta data/turno/equipe'}), 409
        
        # Criar novo registro
        novo_planejamento = DiarioPlanejamento(
            data=data_obj,
            turno=data['turno'],
            equipe=data['equipe'],
            colaborador1=data['colaborador1'],
            colaborador2=data.get('colaborador2'),
            veiculo=data.get('veiculo'),
            regiao=data.get('regiao'),
            protocolos_nao_enviados_prazo=data.get('protocolos_nao_enviados_prazo'),
            protocolos_vencem_no_turno=data.get('protocolos_vencem_no_turno')
        )
        
        db.session.add(novo_planejamento)
        db.session.commit()
        
        return jsonify({
            'message': 'Planejamento criado com sucesso',
            'id': novo_planejamento.id,
            'data': novo_planejamento.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@diario_bp.route('/triagem/<int:planejamento_id>', methods=['PUT'])
@jwt_required()

def atualizar_acompanhamento(planejamento_id):
    """Atualizar dados de acompanhamento da equipe"""
    try:
        planejamento = DiarioPlanejamento.query.get_or_404(planejamento_id)
        data = request.get_json()

        def to_time(time_str):
            return datetime.strptime(time_str, '%H:%M:%S').time() if time_str else None

        # Atualizar campos de acompanhamento
        planejamento.horario_saida_base = to_time(data.get('horario_saida_base'))
        planejamento.horario_primeiro_atendimento = to_time(data.get('horario_primeiro_atendimento'))
        planejamento.horario_inicio_intervalo = to_time(data.get('horario_inicio_intervalo'))
        planejamento.horario_fim_intervalo = to_time(data.get('horario_fim_intervalo'))
        planejamento.horario_ultimo_atendimento = to_time(data.get('horario_ultimo_atendimento'))
        planejamento.horario_chegada_base = to_time(data.get('horario_chegada_base'))
        
        db.session.commit()
        
        return jsonify({
            'message': 'Acompanhamento atualizado com sucesso',
            'data': planejamento.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def atualizar_triagem(planejamento_id):
    """Atualizar dados da triagem"""
    try:
        planejamento = DiarioPlanejamento.query.get_or_404(planejamento_id)
        data = request.get_json()
        
        # Atualizar campos da triagem
        planejamento.protocolos_prazo = data.get('protocolos_prazo')
        planejamento.protocolos_vencidos = data.get('protocolos_vencidos')
        planejamento.protocolos_nao_enviados_prazo = data.get('protocolos_nao_enviados_prazo') 
        planejamento.protocolos_vencem_no_turno = data.get('protocolos_vencem_no_turno') 
        planejamento.total_protocolos = data.get('total_protocolos')
        
        # Calcular status baseado no percentual de vencidos
        if planejamento.total_protocolos and planejamento.total_protocolos > 0:
            percentual_vencidos = (planejamento.protocolos_vencidos / planejamento.total_protocolos) * 100
            if percentual_vencidos > 30:
                planejamento.status_triagem = 'critico'
            elif percentual_vencidos > 15:
                planejamento.status_triagem = 'atencao'
            else:
                planejamento.status_triagem = 'normal'
        
        db.session.commit()
        
        return jsonify({
            'message': 'Triagem atualizada com sucesso',
            'data': planejamento.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@diario_bp.route('/execucao/<int:planejamento_id>', methods=['PUT'])
def atualizar_execucao(planejamento_id):
    """Atualizar dados da execução"""
    try:
        planejamento = DiarioPlanejamento.query.get_or_404(planejamento_id)
        data = request.get_json()
        
        # Atualizar campos da execução
        planejamento.atendido = data.get('atendido')
        planejamento.impossibilidade = data.get('impossibilidade')
        planejamento.nao_executado = data.get('nao_executado')
        planejamento.comentario_execucao = data.get('comentario_execucao')
        
        # Calcular eficiência
        if planejamento.total_protocolos and planejamento.total_protocolos > 0:
            planejamento.eficiencia = round((planejamento.atendido / planejamento.total_protocolos) * 100)
            
            # Determinar classificação
            if planejamento.eficiencia >= 95:
                planejamento.classificacao = 'excelente'
            elif planejamento.eficiencia >= 85:
                planejamento.classificacao = 'bom'
            elif planejamento.eficiencia >= 70:
                planejamento.classificacao = 'regular'
            else:
                planejamento.classificacao = 'ruim'
        
        db.session.commit()
        
        return jsonify({
            'message': 'Execução atualizada com sucesso',
            'data': planejamento.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@diario_bp.route('/supervisao/<int:planejamento_id>', methods=['PUT'])
def atualizar_supervisao(planejamento_id):
    """Atualizar dados da supervisão"""
    try:
        planejamento = DiarioPlanejamento.query.get_or_404(planejamento_id)
        data = request.get_json()
        
        # Atualizar campos da supervisão
        planejamento.comentario_supervisor = data.get('comentario_supervisor')
        planejamento.sentimento_supervisao = data.get('sentimento_supervisao', 'neutro')
        planejamento.pontos_atencao = data.get('pontos_atencao', False)
        planejamento.status_final = 'supervisionado'
        
        db.session.commit()
        
        return jsonify({
            'message': 'Supervisão atualizada com sucesso',
            'data': planejamento.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@diario_bp.route('/relatorio/<int:planejamento_id>', methods=['POST'])
def gerar_relatorio(planejamento_id):
    """Gerar relatório final"""
    try:
        planejamento = DiarioPlanejamento.query.get_or_404(planejamento_id)
        
        # Gerar relatório consolidado
        relatorio = {
            'cabecalho': {
                'data': planejamento.data.isoformat() if planejamento.data else None,
                'turno': planejamento.turno,
                'equipe': planejamento.equipe,
                'colaboradores': [
                    planejamento.colaborador1,
                    planejamento.colaborador2
                ],
                'veiculo': planejamento.veiculo,
                'regiao': planejamento.regiao
            },
            'protocolos': {
                'no_prazo': planejamento.protocolos_prazo or 0,
                'vencidos': planejamento.protocolos_vencidos or 0,
                'total': planejamento.total_protocolos or 0
            },
            'execucao': {
                'atendido': planejamento.atendido or 0,
                'impossibilidade': planejamento.impossibilidade or 0,
                'nao_executado': planejamento.nao_executado or 0
            },
            'comentarios': {
                'triagem': planejamento.comentario_triagem,
                'execucao': planejamento.comentario_execucao,
                'supervisor': planejamento.comentario_supervisor
            },
            'metricas': {
                'eficiencia': planejamento.eficiencia or 0,
                'classificacao': planejamento.classificacao,
                'status_triagem': planejamento.status_triagem
            },
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Salvar relatório
        relatorio_diario = RelatoriosDiarios(
            data=planejamento.data,
            turno=planejamento.turno,
            equipe=planejamento.equipe
        )
        relatorio_diario.set_relatorio(relatorio)
        
        db.session.add(relatorio_diario)
        
        # Marcar planejamento como finalizado
        planejamento.status_final = 'finalizado'
        
        db.session.commit()
        
        return jsonify({
            'message': 'Relatório gerado com sucesso',
            'relatorio': relatorio
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@diario_bp.route('/planejamentos', methods=['GET'])
def listar_planejamentos():
    """Listar planejamentos com filtros opcionais"""
    try:
        # Parâmetros de filtro
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        equipe = request.args.get('equipe')
        turno = request.args.get('turno')
        
        query = DiarioPlanejamento.query
        
        # Aplicar filtros
        if data_inicio:
            data_inicio_obj = datetime.strptime(data_inicio, '%Y-%m-%d').date()
            query = query.filter(DiarioPlanejamento.data >= data_inicio_obj)
        
        if data_fim:
            data_fim_obj = datetime.strptime(data_fim, '%Y-%m-%d').date()
            query = query.filter(DiarioPlanejamento.data <= data_fim_obj)
        
        if equipe:
            query = query.filter(DiarioPlanejamento.equipe.ilike(f'%{equipe}%'))
        
        if turno:
            query = query.filter(DiarioPlanejamento.turno == turno)
        
        # Ordenar por data mais recente
        planejamentos = query.order_by(DiarioPlanejamento.data.desc()).all()
        
        return jsonify({
            'planejamentos': [p.to_dict() for p in planejamentos],
            'total': len(planejamentos)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@diario_bp.route('/planejamento/<int:planejamento_id>', methods=['GET'])
def obter_planejamento(planejamento_id):
    """Obter planejamento específico"""
    try:
        planejamento = DiarioPlanejamento.query.get_or_404(planejamento_id)
        return jsonify(planejamento.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@diario_bp.route('/relatorios', methods=['GET'])
def listar_relatorios():
    """Listar relatórios gerados"""
    try:
        # Parâmetros de filtro
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        equipe = request.args.get('equipe')
        
        query = RelatoriosDiarios.query
        
        # Aplicar filtros
        if data_inicio:
            data_inicio_obj = datetime.strptime(data_inicio, '%Y-%m-%d').date()
            query = query.filter(RelatoriosDiarios.data >= data_inicio_obj)
        
        if data_fim:
            data_fim_obj = datetime.strptime(data_fim, '%Y-%m-%d').date()
            query = query.filter(RelatoriosDiarios.data <= data_fim_obj)
        
        if equipe:
            query = query.filter(RelatoriosDiarios.equipe.ilike(f'%{equipe}%'))
        
        # Ordenar por data mais recente
        relatorios = query.order_by(RelatoriosDiarios.data.desc()).all()
        
        return jsonify({
            'relatorios': [r.to_dict() for r in relatorios],
            'total': len(relatorios)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@diario_bp.route('/dashboard', methods=['GET'])
def dashboard():
    """Obter dados para dashboard"""
    current_user = get_jwt_identity()

    try:
        # Estatísticas gerais
        total_planejamentos = DiarioPlanejamento.query.count()
        planejamentos_finalizados = DiarioPlanejamento.query.filter_by(status_final='finalizado').count()
        
        # Eficiência média
        eficiencia_media = db.session.query(db.func.avg(DiarioPlanejamento.eficiencia)).filter(
            DiarioPlanejamento.eficiencia.isnot(None)
        ).scalar() or 0
        
        # Planejamentos por status
        status_counts = db.session.query(
            DiarioPlanejamento.status_final,
            db.func.count(DiarioPlanejamento.id)
        ).group_by(DiarioPlanejamento.status_final).all()
        
        # Planejamentos recentes
        planejamentos_recentes = DiarioPlanejamento.query.order_by(
            DiarioPlanejamento.created_at.desc()
        ).limit(5).all()

        total_protocolos_nao_enviados = db.session.query(db.func.sum(DiarioPlanejamento.protocolos_nao_enviados_prazo)).scalar()
        total_protocolos_vencem_hoje = db.session.query(db.func.sum(DiarioPlanejamento.protocolos_vencem_no_turno)).filter(DiarioPlanejamento.data == date.today()).scalar()

        
        return jsonify({
        'estatisticas': {
            'total_planejamentos': total_planejamentos,
            'planejamentos_finalizados': planejamentos_finalizados,
            'eficiencia_media': round(eficiencia_media, 2),
            'status_counts': dict(status_counts),
            'total_protocolos_nao_enviados': total_protocolos_nao_enviados or 0,
            'total_protocolos_vencem_hoje': total_protocolos_vencem_hoje or 0,
        },
        'planejamentos_recentes': [p.to_dict() for p in planejamentos_recentes]
    })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

