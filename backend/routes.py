from flask import request, jsonify
from models import db, Portfolio, Holding, Transaction
from decimal import Decimal
import yfinance_cache as yfc
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import CheckConstraint, func


from models import db, Portfolio, Holding, Transaction

def register_routes(app):

    # Route to handle stock trading - both buy/sell, depending on what user inputs as type
    @app.route('/trade', methods=['POST'])
    def trade_stock():
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON"}), 400

        portfolio_id = data.get('portfolio_id')
        ticker = data.get('ticker', '').upper()
        quantity_str = data.get('quantity')
        transaction_type = data.get('transaction_type', '').lower()

        if not all([portfolio_id, ticker, quantity_str, transaction_type]):
            return jsonify({"error": "Missing required fields: portfolio_id, ticker, quantity, transaction_type"}), 400

        # Validate quantity, make sure positive and numeric
        try:
            quantity = Decimal(quantity_str)
            if quantity <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            return jsonify({"error": "Quantity must be a positive number"}), 400

        # Make sure user only puts buy or sell as transaction type
        if transaction_type not in ['buy', 'sell']:
            return jsonify({"error": "transaction_type must be 'buy' or 'sell'"}), 400

        # Make sure portfolio exists
        portfolio = Portfolio.query.get(portfolio_id)
        if not portfolio:
            return jsonify({"error": "Portfolio not found"}), 404

        # Fetch stock data using yfinance API and validate ticker
        stock = yfc.Ticker(ticker)
        stock_info = stock.info

        if not stock_info.get('regularMarketPrice'):
            return jsonify({"error": f"Invalid ticker symbol: {ticker}"}), 400

        current_price = Decimal(stock_info['regularMarketPrice'])

        if transaction_type == 'buy':
            return handle_buy(portfolio, ticker, quantity, current_price)
        else:
            return handle_sell(portfolio, ticker, quantity, current_price)

    # Function to handle buy transactions
    def handle_buy(portfolio, ticker, quantity, price):
        total_cost = quantity * price
        if portfolio.cash_balance < total_cost:
            return jsonify({"error": "Insufficient cash balance to complete the purchase"}), 400

        try:
            portfolio.cash_balance -= total_cost

            new_transaction = Transaction(
                portfolio_id=portfolio.id,
                ticker=ticker,
                transaction_type='buy',
                price=price,
                quantity=quantity
            )
            db.session.add(new_transaction)

            holding = Holding.query.filter_by(portfolio_id=portfolio.id, ticker=ticker).first()
            if holding:
                old_total_value = holding.quantity * holding.cost_basis
                new_total_value = old_total_value + total_cost
                new_total_quantity = holding.quantity + quantity
                holding.quantity = new_total_quantity
                holding.cost_basis = new_total_value / new_total_quantity
            else:
                new_holding = Holding(
                    portfolio_id=portfolio.id,
                    ticker=ticker,
                    quantity=quantity,
                    cost_basis=price
                )
                db.session.add(new_holding)

            db.session.commit()
            return jsonify({
                "message": "Buy transaction successful",
                "ticker": ticker,
                "quantity": str(quantity),
                "price": str(round(price,2)),
                "new_cash_balance": str(round(portfolio.cash_balance, 2))
            }), 200

        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "An error occurred during the transaction.", "details": str(e)}), 500


    # Function to handle sell transactions
    def handle_sell(portfolio, ticker, quantity, price):
        holding = Holding.query.filter_by(portfolio_id=portfolio.id, ticker=ticker).first()

        if not holding:
            return jsonify({"error": f"You do not own any shares of {ticker}"}), 400

        if quantity > holding.quantity:
            return jsonify({"error": f"Sell quantity ({quantity}) exceeds holdings ({holding.quantity})"}), 400

        try:
            total_sale_value = quantity * price
            portfolio.cash_balance += total_sale_value

            new_transaction = Transaction(
                portfolio_id=portfolio.id,
                ticker=ticker,
                transaction_type='sell',
                price=price,
                quantity=quantity
            )
            db.session.add(new_transaction)

            holding.quantity -= quantity
            if holding.quantity == 0:
                db.session.delete(holding)

            db.session.commit()
            return jsonify({
                "message": "Sell transaction successful",
                "ticker": ticker,
                "quantity": str(quantity),
                "price": str(round(price, 2)),
                "new_cash_balance": str(round(portfolio.cash_balance, 2))
            }), 200

        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "An error occurred during the transaction.", "details": str(e)}), 500
    
    # Get all transactions for a specific portfolio
    @app.route('/transactions/<int:portfolio_id>', methods=['GET'])
    def get_transactions(portfolio_id):
        """Returns a list of all transactions for a specific portfolio."""
        portfolio = Portfolio.query.get(portfolio_id)
        if not portfolio:
            return jsonify({"error": "Portfolio not found"}), 404
            
        transactions = Transaction.query.filter_by(portfolio_id=portfolio_id).all()
        
        transactions_data = [{
            "id": t.id,
            "ticker": t.ticker,
            "transaction_type": t.transaction_type,
            "price": str(t.price),
            "quantity": str(t.quantity),
            "transaction_date": t.transaction_date.isoformat()
        } for t in transactions]

        return jsonify(transactions_data), 200
    
    # Utility function to get just the current price of a stock
    def get_current_price(ticker):
        try:
            stock = yfc.Ticker(ticker)
            info = stock.info
            return info.get('regularMarketPrice')
        except Exception as e:
            print(f"Error fetching current price for {ticker}: {str(e)}")
            return 0

    # Function to fetch stock data using yfinance
    @app.route('/quote/<ticker>')
    def get_quote(ticker):
        try:
            # Validate ticker format (basic check)
            if not ticker or len(ticker.strip()) == 0:
                return jsonify({"error": "Please enter a valid ticker symbol"}), 400
            
            ticker = ticker.upper().strip()
            stock = yfc.Ticker(ticker)
            info = stock.info

            # Check if yfinance returned valid data
            if not info or not info.get('regularMarketPrice'):
                return jsonify({"error": f"Invalid ticker symbol: {ticker}. Please check the symbol and try again."}), 404

            # Additional validation - check if we have minimal required data
            if not info.get('longName') and not info.get('shortName'):
                return jsonify({"error": f"Invalid ticker symbol: {ticker}. No company information found."}), 404

            # Safe division for percent change
            previous_close = info.get('previousClose', 0)
            regular_market_price = info.get('regularMarketPrice', 0)
            
            if previous_close > 0:
                percent_change = round(((regular_market_price - previous_close) / previous_close) * 100, 2)
            else:
                percent_change = 0

            data = {
                "name": info.get('longName', info.get('shortName', 'N/A')),
                "ticker": ticker,
                "price": round(regular_market_price, 2),
                "change": round(regular_market_price - previous_close, 2),
                "percent_change": percent_change,
                "day_high": round(info.get('regularMarketDayHigh', 0), 2),
                "day_low": round(info.get('regularMarketDayLow', 0), 2),
                "market_cap": info.get('marketCap', 0),
                "week_52_high": round(info.get('fiftyTwoWeekHigh', 0), 2),
                "week_52_low": round(info.get('fiftyTwoWeekLow', 0), 2),
                "volume": info.get('regularMarketVolume', 0),
                "pe_ratio": round(info.get('trailingPE', 0), 2) if info.get('trailingPE') else None,
                "dividend_yield": info.get('dividendYield') if info.get('dividendYield') else None,
                "beta": round(info.get('beta', 0), 2) if info.get('beta') else None,
                "sector": info.get('sector', 'N/A'),
                "industry": info.get('industry', 'N/A')
            }
            return jsonify(data)        
        except Exception as e:
            return jsonify({"error": f"Invalid ticker symbol: {ticker}. Please verify the symbol and try again."}), 404

    @app.route('/portfolio', methods=['GET'])
    def get_portfolio():
        """MVP 1 : Get user portfolio"""
        try:
            portfolio = Portfolio.query.filter_by(id=1).first() #using the single first portfolio

            holdings = Holding.query.filter_by(portfolio_id=portfolio.id).all()

            portfolio_data = {
                'id': portfolio.id,
                'name': portfolio.name,
                'cash_balance': round(float(portfolio.cash_balance), 2),
                'holdings': []
            }

            total_value = float(portfolio.cash_balance)

            for holding in holdings:
                current_price = get_current_price(holding.ticker)
                market_value = float(holding.quantity) * current_price
                total_value += market_value
                
                portfolio_data['holdings'].append({
                    'id': holding.id,
                    'ticker': holding.ticker,
                    'quantity': float(holding.quantity),
                    'cost_basis': float(holding.cost_basis),
                    'current_price': current_price,
                    'market_value': market_value,
                    'unrealized_pnl': market_value - (float(holding.quantity) * float(holding.cost_basis))
                })

            portfolio_data['total_value'] = round(total_value, 2)
            
            return jsonify(portfolio_data)
        
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        
    @app.route('/pnl', methods=['GET'])
    def get_profit_loss():
        """MVP 3 : Get Profit/loss"""
        try:
            portfolio = Portfolio.query.filter_by(id=1).first()
            if not portfolio:
                return jsonify({'error': 'Portfolio not found'}), 404
            holdings = Holding.query.filter_by(portfolio_id=portfolio.id).all()
            #Calculate Unrealized P&L from current holdings
            total_unrealized_pnl = 0
            total_cost_basis = 0
            total_market_value = 0

            for holding in holdings:
                current_price = get_current_price(holding.ticker)
                market_value = float(holding.quantity) * current_price
                cost_basis_value = float(holding.quantity) * float(holding.cost_basis)
                unrealized_pnl = market_value - cost_basis_value
                
                total_market_value += market_value
                total_cost_basis += cost_basis_value
                total_unrealized_pnl += unrealized_pnl
            
            # Calculate realized P&L from historical transactions
            realized_pnl_sum = db.session.query(func.sum(Transaction.realized_pnl)).filter(
                Transaction.portfolio_id == portfolio.id,
                Transaction.transaction_type == 'sell'
            ).scalar()
            
            # The sum() function returns None if no matching records are found, so handle this
            total_realized_pnl = float(realized_pnl_sum) if realized_pnl_sum is not None else 0

            #combine and return results
            pnl_data = {
                'total_unrealized_pnl': total_unrealized_pnl,
                'total_realized_pnl': total_realized_pnl,
                'total_pnl': total_unrealized_pnl + total_realized_pnl,
                'total_cost_basis': total_cost_basis,
                'total_market_value': total_market_value,
                'return_percentage': (total_unrealized_pnl / total_cost_basis * 100) if total_cost_basis > 0 else 0
            }
            
            return jsonify(pnl_data)
        
        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
    # ---- FOR TESTING PURPOSES ONLY ----
    # Resetting the database and creating a default portfolio
    @app.route('/setup', methods=['POST'])
    def setup_portfolio():
        with app.app_context():
            db.drop_all()
            db.create_all()
            portfolio = Portfolio(name="Default Portfolio", cash_balance=Decimal('100000.00'))
            db.session.add(portfolio)
            db.session.commit()

            holding = Holding(portfolio_id=portfolio.id, ticker='AAPL', quantity=Decimal('10'), cost_basis=Decimal('150.00'))
            holding2 = Holding(portfolio_id=portfolio.id, ticker='GOOGL', quantity=Decimal('5'), cost_basis=Decimal('280.00'))
            transaction = Transaction(portfolio_id=portfolio.id, ticker='AAPL', transaction_type='buy', price=Decimal('150.00'), quantity=Decimal('10'))
            db.session.add(holding)
            db.session.add(holding2)
            db.session.add(transaction)
            db.session.commit()
            return jsonify({"message": "Database reset and default portfolio created.", "portfolio_id": portfolio.id}), 201