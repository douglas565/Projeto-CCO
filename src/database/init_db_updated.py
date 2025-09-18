import os
import sys

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from src.models.user import User, Profile, Team, db
from flask import Flask

def init_database():
    """Inicializa o banco de dados com os novos modelos e dados padrão"""
    
    # Configurar Flask app
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'app.db')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Inicializar banco
    db.init_app(app)
    
    with app.app_context():
        # Criar todas as tabelas
        db.create_all()
        
        # Criar perfis padrão se não existirem
        profiles_data = [
            {'name': 'Equipe', 'description': 'Usuário de equipe operacional'},
            {'name': 'Supervisor', 'description': 'Supervisor de equipes'},
            {'name': 'CCO', 'description': 'Centro de Controle Operacional'},
            {'name': 'Administrador', 'description': 'Administrador do sistema'}
        ]
        
        for profile_data in profiles_data:
            if not Profile.query.filter_by(name=profile_data['name']).first():
                profile = Profile(**profile_data)
                db.session.add(profile)
                print(f"✅ Perfil '{profile_data['name']}' criado!")
        
        db.session.commit()
        
        # Criar equipes padrão se não existirem
        teams_data = [
            {'name': 'Equipe 01'},
            {'name': 'Equipe 02'},
            {'name': 'Equipe 03'},
            {'name': 'Equipe 04'},
            {'name': 'Equipe 05'}
        ]
        
        for team_data in teams_data:
            if not Team.query.filter_by(name=team_data['name']).first():
                team = Team(**team_data)
                db.session.add(team)
                print(f"✅ Equipe '{team_data['name']}' criada!")
        
        db.session.commit()
        
        # Criar usuário admin padrão se não existir
        admin_profile = Profile.query.filter_by(name='Administrador').first()
        if not User.query.filter_by(username='admin').first() and admin_profile:
            admin_user = User(
                username='admin',
                email='admin@engie.com',
                profile_id=admin_profile.id
            )
            admin_user.set_password('admin123')
            db.session.add(admin_user)
            print("✅ Usuário admin criado com sucesso!")
            print("   Username: admin")
            print("   Password: admin123")
            print("   Email: admin@engie.com")
            print("   Profile: Administrador")
        else:
            print("ℹ️  Usuário admin já existe no banco de dados")
            
        # Criar usuários de exemplo
        users_example = [
            {
                'username': 'supervisor1',
                'email': 'supervisor1@engie.com',
                'password': 'super123',
                'profile': 'Supervisor'
            },
            {
                'username': 'colaborador1',
                'email': 'colaborador1@engie.com',
                'password': 'colab123',
                'profile': 'Equipe'
            },
            {
                'username': 'cco1',
                'email': 'cco1@engie.com',
                'password': 'cco123',
                'profile': 'CCO'
            }
        ]
        
        for user_data in users_example:
            existing_user = User.query.filter_by(username=user_data['username']).first()
            if not existing_user:
                profile = Profile.query.filter_by(name=user_data['profile']).first()
                if profile:
                    new_user = User(
                        username=user_data['username'],
                        email=user_data['email'],
                        profile_id=profile.id
                    )
                    new_user.set_password(user_data['password'])
                    db.session.add(new_user)
                    print(f"✅ Usuário '{user_data['username']}' criado!")
                
        db.session.commit()
        
        # Listar todos os usuários
        all_users = User.query.all()
        print("\n📋 Usuários no sistema:")
        for user in all_users:
            profile_name = user.profile.name if user.profile else 'Sem perfil'
            team_name = user.team.name if user.team else 'Sem equipe'
            print(f"   - {user.username} ({profile_name}) - {user.email} - Equipe: {team_name}")
        
        # Listar perfis
        all_profiles = Profile.query.all()
        print("\n👥 Perfis disponíveis:")
        for profile in all_profiles:
            print(f"   - {profile.name}: {profile.description}")
        
        # Listar equipes
        all_teams = Team.query.all()
        print("\n🏢 Equipes disponíveis:")
        for team in all_teams:
            print(f"   - {team.name}")

if __name__ == '__main__':
    init_database()

