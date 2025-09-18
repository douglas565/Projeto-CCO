from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

class Profile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)  # 'Equipe', 'Supervisor', 'CCO'
    description = db.Column(db.String(200))
    
    # Relacionamento com usuários
    users = db.relationship('User', backref='profile', lazy=True)
    
    def __repr__(self):
        return f'<Profile {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description
        }

class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    supervisor_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    
    # Relacionamento com usuários
    users = db.relationship('User', backref='team', lazy=True, foreign_keys='User.team_id')
    
    def __repr__(self):
        return f'<Team {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'supervisor_id': self.supervisor_id
        }

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # Relacionamentos
    profile_id = db.Column(db.Integer, db.ForeignKey('profile.id'), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)

    def set_password(self, password):
        """Define a senha do usuário com hash"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Verifica se a senha está correta"""
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'profile_id': self.profile_id,
            'profile_name': self.profile.name if self.profile else None,
            'team_id': self.team_id,
            'team_name': self.team.name if self.team else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
