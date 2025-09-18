from flask import Blueprint, request, jsonify, session
from werkzeug.security import check_password_hash
from ..models.user import User, Profile, Team, db
import jwt
import datetime
from functools import wraps

auth_bp = Blueprint('auth', __name__)

# Chave secreta para JWT (em produção, usar variável de ambiente)
JWT_SECRET = 'sua_chave_secreta_aqui'

def token_required(f):
    """Decorator para verificar token JWT"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Verificar se o token está no header Authorization
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'message': 'Token inválido!'}), 401
        
        if not token:
            return jsonify({'message': 'Token é obrigatório!'}), 401
        
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            current_user = User.query.filter_by(id=data['user_id']).first()
            if not current_user:
                return jsonify({'message': 'Usuário não encontrado!'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token expirado!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token inválido!'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

def profile_required(allowed_profiles):
    """Decorator para verificar perfil do usuário"""
    def decorator(f):
        @wraps(f)
        def decorated(current_user, *args, **kwargs):
            if current_user.profile.name not in allowed_profiles:
                return jsonify({'message': 'Acesso negado! Perfil insuficiente.'}), 403
            return f(current_user, *args, **kwargs)
        return decorated
    return decorator

@auth_bp.route('/login', methods=['POST'])
def login():
    """Endpoint de login"""
    try:
        data = request.get_json()
        
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'message': 'Username e password são obrigatórios!'}), 400
        
        user = User.query.filter_by(username=data['username']).first()
        
        if not user or not user.check_password(data['password']):
            return jsonify({'message': 'Credenciais inválidas!'}), 401
        
        if not user.is_active:
            return jsonify({'message': 'Usuário inativo!'}), 401
        
        # Gerar token JWT
        token = jwt.encode({
            'user_id': user.id,
            'username': user.username,
            'profile': user.profile.name,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, JWT_SECRET, algorithm='HS256')
        
        return jsonify({
            'message': 'Login realizado com sucesso!',
            'token': token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'message': f'Erro interno: {str(e)}'}), 500

@auth_bp.route('/register', methods=['POST'])
def register():
    """Endpoint de registro (apenas para administradores)"""
    try:
        data = request.get_json()
        
        # Validar dados obrigatórios
        required_fields = ['username', 'email', 'password', 'profile_id']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'message': f'Campo {field} é obrigatório!'}), 400
        
        # Verificar se usuário já existe
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'message': 'Username já existe!'}), 400
        
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'message': 'Email já existe!'}), 400
        
        # Verificar se o perfil existe
        profile = Profile.query.get(data['profile_id'])
        if not profile:
            return jsonify({'message': 'Perfil inválido!'}), 400
        
        # Criar novo usuário
        new_user = User(
            username=data['username'],
            email=data['email'],
            profile_id=data['profile_id'],
            team_id=data.get('team_id')
        )
        new_user.set_password(data['password'])
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            'message': 'Usuário criado com sucesso!',
            'user': new_user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Erro interno: {str(e)}'}), 500

@auth_bp.route('/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    """Obter informações do usuário atual"""
    return jsonify({'user': current_user.to_dict()}), 200

@auth_bp.route('/profiles', methods=['GET'])
def get_profiles():
    """Listar todos os perfis disponíveis"""
    try:
        profiles = Profile.query.all()
        return jsonify({
            'profiles': [profile.to_dict() for profile in profiles]
        }), 200
    except Exception as e:
        return jsonify({'message': f'Erro interno: {str(e)}'}), 500

@auth_bp.route('/teams', methods=['GET'])
@token_required
def get_teams(current_user):
    """Listar todas as equipes"""
    try:
        teams = Team.query.all()
        return jsonify({
            'teams': [team.to_dict() for team in teams]
        }), 200
    except Exception as e:
        return jsonify({'message': f'Erro interno: {str(e)}'}), 500

@auth_bp.route('/init-data', methods=['POST'])
def init_default_data():
    """Inicializar dados padrão (perfis e usuário admin)"""
    try:
        # Criar perfis padrão se não existirem
        profiles_data = [
            {'name': 'Equipe', 'description': 'Usuário de equipe operacional'},
            {'name': 'Supervisor', 'description': 'Supervisor de equipes'},
            {'name': 'CCO', 'description': 'Centro de Controle Operacional'}
        ]
        
        for profile_data in profiles_data:
            if not Profile.query.filter_by(name=profile_data['name']).first():
                profile = Profile(**profile_data)
                db.session.add(profile)
        
        # Criar usuário admin padrão se não existir
        if not User.query.filter_by(username='admin').first():
            cco_profile = Profile.query.filter_by(name='CCO').first()
            if cco_profile:
                admin_user = User(
                    username='admin',
                    email='admin@diario.com',
                    profile_id=cco_profile.id
                )
                admin_user.set_password('admin123')
                db.session.add(admin_user)
        
        db.session.commit()
        
        return jsonify({'message': 'Dados iniciais criados com sucesso!'}), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Erro interno: {str(e)}'}), 500

