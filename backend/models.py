from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import CheckConstraint
from datetime import datetime

db = SQLAlchemy()

# Portfolio model to represent a collection of stock holdings, including cash balance
class Portfolio(db.Model):
    __tablename__ = 'portfolios'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255))
    cash_balance = db.Column(db.Numeric(10, 4))

    # Cascade delete for holdings and transactions to ensure they are removed when the portfolio is deleted
    holdings = db.relationship('Holding', backref='portfolio', cascade="all, delete-orphan")
    transactions = db.relationship('Transaction', backref='portfolio', cascade="all, delete-orphan")


# Holding model to represent individual stock holdings in a portfolio, all rows are unique
class Holding(db.Model):
    __tablename__ = 'holdings'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ticker = db.Column(db.String(255), nullable=False)
    quantity = db.Column(db.Numeric(18, 8), nullable=False)
    cost_basis = db.Column(db.Numeric(10, 4), nullable=False)

    # Foreign key to link holding to a portfolio
    portfolio_id = db.Column(db.Integer, db.ForeignKey('portfolios.id'), nullable=False)

    # Ensure that quantity is always positive
    __table_args__ = (
        CheckConstraint('quantity > 0', name='check_quantity_positive'),
    )


# Transaction model to record buy/sell actions
class Transaction(db.Model):
    __tablename__ = 'transactions'

    id = db.Column(db.Integer, primary_key=True)
    transaction_type = db.Column(db.String(255))  # 'buy'/'sell' or +/-? 
    price = db.Column(db.Numeric(10, 4))
    quantity = db.Column(db.Integer)
    transaction_date = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)

    # Foreign key to link transaction to a portfolio
    portfolio_id = db.Column(db.Integer, db.ForeignKey('portfolios.id'), nullable=False)