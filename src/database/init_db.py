import os
import sys

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from src.models.user import User, db
from flask import Flask

def init_database():
    """Inicializa o banco de dados e cria usuário admin padrão"""
    
    # Configurar Flask app
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'app.db')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Inicializar banco
    db.init_app(app)
    
    with app.app_context():
        # Criar todas as tabelas
        db.create_all()
        
        # Verificar se já existe usuário admin
        admin_user = User.query.filter_by(username='admin').first()
        
        if not admin_user:
            # Criar usuário admin padrão
            admin_user = User(
                username='admin',
                email='admin@engie.com',
                role='administrador'
            )
            admin_user.set_password('admin123')
            
            db.session.add(admin_user)
            db.session.commit()
            
            print("✅ Usuário admin criado com sucesso!")
            print("   Username: admin")
            print("   Password: admin123")
            print("   Email: admin@engie.com")
            print("   Role: administrador")
        else:
            print("ℹ️  Usuário admin já existe no banco de dados")
            
        # Criar alguns usuários de exemplo
        users_example = [
            {
                'username': 'supervisor1',
                'email': 'supervisor1@engie.com',
                'password': 'super123',
                'role': 'supervisor'
            },
            {
                'username': 'colaborador1',
                'email': 'colaborador1@engie.com',
                'password': 'colab123',
                'role': 'colaborador'
            }
        ]
        
        for user_data in users_example:
            existing_user = User.query.filter_by(username=user_data['username']).first()
            if not existing_user:
                new_user = User(
                    username=user_data['username'],
                    email=user_data['email'],
                    role=user_data['role']
                )
                new_user.set_password(user_data['password'])
                db.session.add(new_user)
                
        db.session.commit()
        print("✅ Usuários de exemplo criados!")
        
        # Listar todos os usuários
        all_users = User.query.all()
        print("\n📋 Usuários no sistema:")
        for user in all_users:
            print(f"   - {user.username} ({user.role}) - {user.email}")

if __name__ == '__main__':
    init_database()

