from flask import Blueprint, jsonify, request
from src.models.user import User, db
from flask_jwt_extended import create_access_token

user_bp = Blueprint('user', __name__)

@user_bp.route('/users', methods=['GET'])

def register():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({"erro": "Faltam dados para o registro"}), 400

    if User.query.filter_by(username=data['username']).first() or User.query.filter_by(email=data['email']).first():
        return jsonify({"erro": "Usuário ou email já existe"}), 400

    user = User(username=data['username'], email=data['email'], role=data.get('role', 'colaborador'))
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()


    return jsonify(user.to_dict()), 201

@user_bp.route('/login', methods=['POST'])


def login():

    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({"erro": "Faltam dados para o login"}), 400

    user = User.query.filter_by(username=data['username']).first()

    if user is None or not user.check_password(data['password']):
        return jsonify({"erro": "Usuário ou senha inválidos"}), 401

    acess_token = create_access_token(identity={'username': user.username, 'role': user.role})
    return jsonify(access_token=acess_token), 200




def get_users():
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])

@user_bp.route('/users', methods=['POST'])
def create_user():
    
    data = request.json
    user = User(username=data['username'], email=data['email'])
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201

@user_bp.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())

@user_bp.route('/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.json
    user.username = data.get('username', user.username)
    user.email = data.get('email', user.email)
    db.session.commit()
    return jsonify(user.to_dict())

@user_bp.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return '', 204
