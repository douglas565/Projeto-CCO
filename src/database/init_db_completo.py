import os
import sys

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from src.models.diario_completo import (
    User, Profile, Team, DiarioPlanejamentoExecucao, ProtocoloExecucao,
    DiarioAcompanhamento, ReportFalhasOperacionais, ControleCCO, LogSistema, db
)
from flask import Flask
import json
from datetime import datetime, date, time

def init_database_completo():
    """Inicializa o banco de dados com os modelos refinados baseados nas sheets do Excel"""
    
    # Configurar Flask app
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'app_completo.db')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Inicializar banco
    db.init_app(app)
    
    with app.app_context():
        # Criar todas as tabelas
        db.create_all()
        
        print("=== INICIALIZAÇÃO DO BANCO DE DADOS COMPLETO ===")
        print("Baseado na análise das sheets do Excel FR-CWB-GL-0001-00")
        print()
        
        # 1. Criar perfis
        print("1. Criando perfis de usuário...")
        profiles_data = [
            {
                'name': 'Funcionário Campo',
                'description': 'Funcionário que executa serviços em campo',
                'permissions': json.dumps(['criar_diario_execucao', 'editar_diario_execucao', 'visualizar_protocolos'])
            },
            {
                'name': 'Supervisor',
                'description': 'Supervisor de equipes operacionais',
                'permissions': json.dumps(['criar_diario_acompanhamento', 'criar_report_falhas', 'aprovar_diarios', 'visualizar_todos_diarios'])
            },
            {
                'name': 'CCO',
                'description': 'Centro de Controle Operacional',
                'permissions': json.dumps(['controle_cco', 'visualizar_dashboards', 'gerar_relatorios'])
            },
            {
                'name': 'Administrador',
                'description': 'Administrador do sistema',
                'permissions': json.dumps(['admin_total', 'gerenciar_usuarios', 'configurar_sistema'])
            }
        ]
        
        for profile_data in profiles_data:
            if not Profile.query.filter_by(name=profile_data['name']).first():
                profile = Profile(**profile_data)
                db.session.add(profile)
                print(f"✅ Perfil '{profile_data['name']}' criado!")
        
        db.session.commit()
        
        # 2. Criar equipes
        print("\n2. Criando equipes...")
        teams_data = [
            {'name': 'Man-IP-01 | ENGIE', 'description': 'Equipe de Manutenção IP 01'},
            {'name': 'Man-IP-02 | ENGIE', 'description': 'Equipe de Manutenção IP 02'},
            {'name': 'Man-IP-03 | ENGIE', 'description': 'Equipe de Manutenção IP 03'},
            {'name': 'Man-IP-04 | ENGIE', 'description': 'Equipe de Manutenção IP 04'},
            {'name': 'Man-IP-05 | ENGIE', 'description': 'Equipe de Manutenção IP 05'},
            {'name': 'Equipe 18', 'description': 'Equipe Operacional 18'},
            {'name': 'Equipe 19', 'description': 'Equipe Operacional 19'},
            {'name': 'Equipe 20', 'description': 'Equipe Operacional 20'}
        ]
        
        for team_data in teams_data:
            if not Team.query.filter_by(name=team_data['name']).first():
                team = Team(**team_data)
                db.session.add(team)
                print(f"✅ Equipe '{team_data['name']}' criada!")
        
        db.session.commit()
        
        # 3. Criar usuários
        print("\n3. Criando usuários...")
        
        # Buscar perfis e equipes
        admin_profile = Profile.query.filter_by(name='Administrador').first()
        supervisor_profile = Profile.query.filter_by(name='Supervisor').first()
        campo_profile = Profile.query.filter_by(name='Funcionário Campo').first()
        cco_profile = Profile.query.filter_by(name='CCO').first()
        
        equipe_01 = Team.query.filter_by(name='Man-IP-01 | ENGIE').first()
        equipe_02 = Team.query.filter_by(name='Man-IP-02 | ENGIE').first()
        equipe_18 = Team.query.filter_by(name='Equipe 18').first()
        
        users_data = [
            # Administrador
            {
                'username': 'admin',
                'email': 'admin@engie.com',
                'password': 'admin123',
                'profile_id': admin_profile.id if admin_profile else None
            },
            # Supervisores
            {
                'username': 'debora.supervisor',
                'email': 'debora@engie.com',
                'password': 'super123',
                'profile_id': supervisor_profile.id if supervisor_profile else None
            },
            {
                'username': 'adriano.supervisor',
                'email': 'adriano@engie.com',
                'password': 'super123',
                'profile_id': supervisor_profile.id if supervisor_profile else None
            },
            {
                'username': 'joao.supervisor',
                'email': 'joao.henrique@engie.com',
                'password': 'super123',
                'profile_id': supervisor_profile.id if supervisor_profile else None
            },
            # Funcionários de campo
            {
                'username': 'carlos.campo',
                'email': 'carlos.campo@engie.com',
                'password': 'campo123',
                'profile_id': campo_profile.id if campo_profile else None,
                'team_id': equipe_01.id if equipe_01 else None
            },
            {
                'username': 'maria.campo',
                'email': 'maria.campo@engie.com',
                'password': 'campo123',
                'profile_id': campo_profile.id if campo_profile else None,
                'team_id': equipe_02.id if equipe_02 else None
            },
            {
                'username': 'jose.campo',
                'email': 'jose.campo@engie.com',
                'password': 'campo123',
                'profile_id': campo_profile.id if campo_profile else None,
                'team_id': equipe_18.id if equipe_18 else None
            },
            # CCO
            {
                'username': 'cco.operador',
                'email': 'cco@engie.com',
                'password': 'cco123',
                'profile_id': cco_profile.id if cco_profile else None
            }
        ]
        
        for user_data in users_data:
            existing_user = User.query.filter_by(username=user_data['username']).first()
            if not existing_user:
                new_user = User(
                    username=user_data['username'],
                    email=user_data['email'],
                    profile_id=user_data['profile_id'],
                    team_id=user_data.get('team_id')
                )
                new_user.set_password(user_data['password'])
                db.session.add(new_user)
                print(f"✅ Usuário '{user_data['username']}' criado!")
        
        db.session.commit()
        
        # 4. Criar dados de exemplo
        print("\n4. Criando dados de exemplo...")
        
        # Buscar usuários para exemplos
        carlos = User.query.filter_by(username='carlos.campo').first()
        debora = User.query.filter_by(username='debora.supervisor').first()
        
        if carlos:
            # Exemplo de Diário de Planejamento e Execução
            diario_execucao = DiarioPlanejamentoExecucao(
                data=date.today(),
                turno='M1',
                equipe='Man-IP-01 | ENGIE',
                colaborador1='Carlos Silva',
                colaborador2='Ana Santos',
                veiculo='VAN-001',
                regiao='Curitiba Centro',
                horario_saida_base=time(7, 0),
                horario_primeiro_atendimento=time(8, 30),
                horario_inicio_intervalo=time(12, 0),
                horario_fim_intervalo=time(13, 0),
                horario_ultimo_atendimento=time(16, 30),
                horario_chegada_base=time(17, 30),
                protocolos_recebidos=15,
                protocolos_executados=12,
                protocolos_pendentes=2,
                protocolos_impossibilidade=1,
                observacoes_campo='Dia produtivo, boa colaboração da equipe',
                dificuldades_encontradas='Trânsito intenso na região central',
                materiais_utilizados='Cabos, conectores, ferramentas básicas',
                status='finalizado',
                created_by=carlos.id
            )
            db.session.add(diario_execucao)
            db.session.commit()
            
            # Protocolos de exemplo
            protocolos_exemplo = [
                {
                    'numero_protocolo': 'PROT-2024-001',
                    'numero_os': 'OS-12345',
                    'tipo_servico': 'Instalação',
                    'endereco': 'Rua das Flores, 123 - Centro',
                    'cliente': 'João da Silva',
                    'status': 'executado',
                    'horario_inicio': time(8, 30),
                    'horario_fim': time(9, 15),
                    'observacoes': 'Instalação realizada com sucesso'
                },
                {
                    'numero_protocolo': 'PROT-2024-002',
                    'numero_os': 'OS-12346',
                    'tipo_servico': 'Manutenção',
                    'endereco': 'Av. Brasil, 456 - Batel',
                    'cliente': 'Maria Oliveira',
                    'status': 'impossibilidade',
                    'motivo_impossibilidade': 'Cliente ausente'
                }
            ]
            
            for prot_data in protocolos_exemplo:
                protocolo = ProtocoloExecucao(
                    diario_id=diario_execucao.id,
                    **prot_data
                )
                db.session.add(protocolo)
            
            print("✅ Diário de execução de exemplo criado!")
        
        if debora and carlos:
            # Exemplo de Diário de Acompanhamento
            diario_acompanhamento = DiarioAcompanhamento(
                data=date.today(),
                turno='M1',
                supervisor='Débora Santos',
                diario_execucao_id=diario_execucao.id if 'diario_execucao' in locals() else None,
                analise_geral='Conforme',
                pontos_atencao='Atenção ao tempo de deslocamento',
                observacoes_supervisor='Equipe demonstrou boa performance',
                total_equipes_ativas=3,
                total_protocolos_dia=45,
                total_executados=38,
                total_pendentes=5,
                total_impossibilidades=2,
                percentual_eficiencia=84.4,
                qualidade_execucao='Boa',
                status='aprovado',
                created_by=debora.id
            )
            db.session.add(diario_acompanhamento)
            
            # Exemplo de Report de Falhas
            report_falha = ReportFalhasOperacionais(
                data_ocorrencia=date.today(),
                turno='M1',
                equipe_envolvida='Man-IP-01 | ENGIE',
                responsavel_report='Débora Santos',
                tipo_falha='Operacional',
                severidade='Média',
                categoria='Processo',
                descricao_falha='Atraso no início das atividades devido a problema no veículo',
                causa_raiz='Falha na manutenção preventiva do veículo',
                impacto_operacional='Atraso de 30 minutos no cronograma',
                acao_imediata='Substituição do veículo',
                acao_corretiva='Revisão do plano de manutenção preventiva',
                acao_preventiva='Implementar checklist diário de veículos',
                responsavel_acao='Supervisor de Frota',
                prazo_conclusao=date(2024, 12, 31),
                status='em_andamento',
                created_by=debora.id
            )
            db.session.add(report_falha)
            
            print("✅ Diário de acompanhamento e report de falhas de exemplo criados!")
        
        db.session.commit()
        
        # 5. Estatísticas finais
        print("\n=== ESTATÍSTICAS DO BANCO ===")
        print(f"👥 Usuários: {User.query.count()}")
        print(f"🏢 Equipes: {Team.query.count()}")
        print(f"👤 Perfis: {Profile.query.count()}")
        print(f"📋 Diários de Execução: {DiarioPlanejamentoExecucao.query.count()}")
        print(f"📊 Diários de Acompanhamento: {DiarioAcompanhamento.query.count()}")
        print(f"⚠️  Reports de Falhas: {ReportFalhasOperacionais.query.count()}")
        print(f"🔧 Protocolos: {ProtocoloExecucao.query.count()}")
        
        print("\n=== USUÁRIOS CRIADOS ===")
        all_users = User.query.all()
        for user in all_users:
            profile_name = user.profile.name if user.profile else 'Sem perfil'
            team_name = user.team.name if user.team else 'Sem equipe'
            print(f"   - {user.username} ({profile_name}) - {user.email}")
            print(f"     Equipe: {team_name}")
        
        print("\n=== CREDENCIAIS DE ACESSO ===")
        print("🔑 Admin: admin / admin123")
        print("🔑 Supervisor: debora.supervisor / super123")
        print("🔑 Campo: carlos.campo / campo123")
        print("🔑 CCO: cco.operador / cco123")
        
        print("\n✅ Banco de dados inicializado com sucesso!")
        print(f"📁 Arquivo: {os.path.join(os.path.dirname(__file__), 'app_completo.db')}")

if __name__ == '__main__':
    init_database_completo()

