from flask import request, jsonify
from models import db, Portfolio, Holding, Transaction
from decimal import Decimal
import yfinance as yf
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import CheckConstraint, func
from datetime import datetime, timezone, timedelta
import pytz


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

        # Fetch stock data using yfinance API at execution time
        try:
            stock = yf.Ticker(ticker)
            stock_info = stock.info

            if not stock_info.get('regularMarketPrice'):
                return jsonify({"error": f"Invalid ticker symbol: {ticker}"}), 400

            # Use the most current price available at execution
            current_price = Decimal(stock_info['regularMarketPrice'])
            
        except Exception as e:
            return jsonify({"error": f"Failed to fetch current price for {ticker}: {str(e)}"}), 500

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
                quantity=quantity,
                transaction_date=datetime.now()
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
                "price": str(round(price, 4)),
                "execution_price": str(round(price, 4)),  # Make it clear this is the execution price
                "total_cost": str(round(quantity * price, 2)),
                "new_cash_balance": str(round(portfolio.cash_balance, 4))
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
            return jsonify({"error": f"Sell quantity ({quantity}) exceeds holding quantity ({int(holding.quantity)})"}), 400

        try:
            total_sale_value = quantity * price
            portfolio.cash_balance += total_sale_value
            old_total_value = holding.quantity * holding.cost_basis

            # Calculate realized P&L
            cost_basis_value = quantity * holding.cost_basis
            realized_pnl = total_sale_value - cost_basis_value

            new_transaction = Transaction(
                portfolio_id=portfolio.id,
                ticker=ticker,
                transaction_type='sell',
                price=price,
                quantity=quantity,
                realized_pnl=realized_pnl,
                transaction_date=datetime.now()
            )
            db.session.add(new_transaction)
            holding.quantity -= quantity
            if holding.quantity == 0:
                db.session.delete(holding)
            else:
                # Calculate updated cost basis based on average of all shares held
                new_total_value = old_total_value - (price * quantity)
                holding.cost_basis = new_total_value / holding.quantity

            db.session.commit()
            return jsonify({
                "message": "Sell transaction successful",
                "ticker": ticker,
                "quantity": str(quantity),
                "price": str(round(price, 4)),
                "execution_price": str(round(price, 4)),  # Make it clear this is the execution price
                "total_proceeds": str(round(quantity * price, 2)),
                "realized_pnl": str(round(realized_pnl, 2)),
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
            "realized_pnl": str(t.realized_pnl) if t.realized_pnl else "0.0000",
            "transaction_date": t.transaction_date.isoformat()
        } for t in transactions]

        return jsonify(transactions_data), 200
    
    @app.route('/portfolio/history', methods=['GET'])
    def get_portfolio_history():
        """Get portfolio value history based on transaction dates"""
        print("Portfolio history endpoint called")  # Debug print
        try:
            portfolio = Portfolio.query.filter_by(id=1).first()
            if not portfolio:
                print("Portfolio not found")  # Debug print
                return jsonify({'error': 'Portfolio not found'}), 404

            # Get all transactions ordered by date
            transactions = Transaction.query.filter_by(portfolio_id=portfolio.id).order_by(Transaction.transaction_date.asc()).all()
            
            if not transactions:
                print("No transactions found")  # Debug print
                return jsonify({'error': 'No transactions found'}), 404

            # Simple return of transaction data without complex calculations
            return jsonify({
                'history': [{'date': t.transaction_date.strftime('%Y-%m-%d'), 
                           'ticker': t.ticker, 
                           'type': t.transaction_type} for t in transactions],
                'total_transactions': len(transactions)
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/portfolio/daily-history/<int:days>', methods=['GET'])
    def get_daily_portfolio_history(days=30):
        """Get actual daily portfolio values based on historical transactions"""
        try:
            portfolio = Portfolio.query.filter_by(id=1).first()
            if not portfolio:
                return jsonify({'error': 'Portfolio not found'}), 404

            # Date range
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=days-1)
            
            # Get all transactions up to end date, ordered by date
            transactions = Transaction.query.filter(
                Transaction.portfolio_id == portfolio.id,
                Transaction.transaction_date <= datetime.combine(end_date, datetime.min.time())
            ).order_by(Transaction.transaction_date.asc()).all()
            
            # Get all unique tickers from transactions
            all_tickers = list(set([t.ticker for t in transactions]))
            print(f"Fetching {days} days for {len(all_tickers)} stocks from transactions...")
            
            # Fetch ALL historical data for all tickers at once
            historical_data = {}
            for ticker in all_tickers:
                try:
                    stock = yf.Ticker(ticker)
                    hist = stock.history(start=start_date, end=end_date + timedelta(days=1))
                    historical_data[ticker] = hist['Close'].to_dict() if not hist.empty else {}
                    print(f"✓ {ticker}")
                except Exception as e:
                    print(f"✗ {ticker}: {e}")
                    historical_data[ticker] = {}
            
            initial_cash = 100000  # Starting cash
            daily_snapshots = {}  # date -> {cash, holdings}
            
            # Get info for each day
            for single_date in (start_date + timedelta(n) for n in range(days)):
                # Get transactions up to this date
                relevant_transactions = [t for t in transactions 
                                       if t.transaction_date.date() <= single_date]
                
                # Replay transactions to get portfolio state on this date
                cash = initial_cash
                holdings = {}  # ticker -> {quantity, cost_basis, total_cost_basis}
                
                for transaction in relevant_transactions:
                    ticker = transaction.ticker
                    quantity = float(transaction.quantity)
                    price = float(transaction.price)
                    
                    if transaction.transaction_type == 'buy':
                        total_cost = quantity * price
                        cash -= total_cost
                        
                        if ticker in holdings:
                            # Update existing holding with weighted average cost
                            old_quantity = holdings[ticker]['quantity']
                            old_total_cost = holdings[ticker]['total_cost_basis']
                            new_quantity = old_quantity + quantity
                            new_total_cost = old_total_cost + total_cost
                            
                            holdings[ticker] = {
                                'quantity': new_quantity,
                                'cost_basis': new_total_cost / new_quantity,  # Average cost per share
                                'total_cost_basis': new_total_cost
                            }
                        else:
                            holdings[ticker] = {
                                'quantity': quantity,
                                'cost_basis': price,  # Average cost per share
                                'total_cost_basis': total_cost
                            }
                            
                    else:  # sell
                        total_proceeds = quantity * price
                        cash += total_proceeds
                        
                        if ticker in holdings:
                            # Calculate realized PnL for this sale
                            sale_cost_basis = holdings[ticker]['cost_basis'] * quantity
                            realized_pnl = total_proceeds - sale_cost_basis
                            
                            # Calculate updated cost basis based on average of all shares held
                            remaining_quantity = holdings[ticker]['quantity'] - quantity
                            if remaining_quantity > 0:
                                old_total_value = holdings[ticker]['quantity'] * holdings[ticker]['cost_basis']
                                new_total_value = old_total_value - (price * quantity)
                                
                                holdings[ticker] = {
                                    'quantity': remaining_quantity,
                                    'cost_basis': new_total_value / remaining_quantity,  # Average cost per share
                                    'total_cost_basis': new_total_value
                                }
                            else:
                                # All shares sold, remove holding
                                del holdings[ticker]
                
                # Calculate portfolio value and PnL for this date
                holdings_value = 0
                total_cost_basis = 0
                for ticker, holding_info in holdings.items():
                    price = get_historical_price(ticker, single_date, historical_data)
                    if price is None:
                        price = holding_info['cost_basis']  # Fallback to cost basis
                    holdings_value += holding_info['quantity'] * price
                    total_cost_basis += holding_info['total_cost_basis']
                
                portfolio_value = cash + holdings_value
                unrealized_pnl = holdings_value - total_cost_basis
                
                # Calculate cumulative realized PnL up to this date
                realized_pnl_up_to_date = 0
                for transaction in relevant_transactions:
                    if transaction.transaction_type == 'sell':
                        realized_pnl_up_to_date += float(transaction.realized_pnl or 0)
                
                combined_pnl = unrealized_pnl + realized_pnl_up_to_date
                
                daily_snapshots[single_date] = {
                    'date': single_date.strftime('%Y-%m-%d'),
                    'portfolio_value': round(portfolio_value, 2),
                    'cash_balance': round(cash, 2),
                    'holdings_value': round(holdings_value, 2),
                    'total_cost_basis': round(total_cost_basis, 2),
                    'unrealized_pnl': round(unrealized_pnl, 2),
                    'realized_pnl': round(realized_pnl_up_to_date, 2),
                    'combined_pnl': round(combined_pnl, 2),
                    'holdings_count': len(holdings)
                }
            
            # Convert to list
            daily_history = [daily_snapshots[date] for date in sorted(daily_snapshots.keys())]
            
            return jsonify({
                'daily_history': daily_history,
                'days_requested': days,
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'total_transactions_processed': len(transactions)
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    def get_historical_price(ticker, date, historical_data):
        """Get historical price for a ticker on a specific date with fallback logic"""
        if ticker not in historical_data:
            return None
        
        # Try to find price for this date or nearby dates (within 5 days)
        for day_offset in range(5):
            check_date = date - timedelta(days=day_offset)
            for price_date, price in historical_data[ticker].items():
                if price_date.date() == check_date:
                    return float(price)
        return None
    
    # Utility function to get just the current price of a stock
    def get_current_price(ticker):
        try:
            stock = yf.Ticker(ticker)
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
            stock = yf.Ticker(ticker)
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
                "price": round(regular_market_price, 4),
                "change": round(regular_market_price - previous_close, 4),
                "percent_change": percent_change,
                "day_high": round(info.get('regularMarketDayHigh', 0), 4),
                "day_low": round(info.get('regularMarketDayLow', 0), 4),
                "market_cap": info.get('marketCap', 0),
                "week_52_high": round(info.get('fiftyTwoWeekHigh', 0), 2),
                "week_52_low": round(info.get('fiftyTwoWeekLow', 0), 2),
                "volume": info.get('regularMarketVolume', 0),
                "pe_ratio": round(info.get('trailingPE', 0), 2) if info.get('trailingPE') else None,
                "dividend_yield": info.get('dividendYield') if info.get('dividendYield') else None,
                "beta": round(info.get('beta', 0), 4) if info.get('beta') else None,
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
        
    @app.route('/market-indices', methods=['GET'])
    def get_market_indices():
        """Get real-time market indices data"""
        try:
            indices = [
                {'name': 'Dow Jones', 'symbol': '^DJI'},
                {'name': 'S&P 500', 'symbol': '^GSPC'},
                {'name': 'NASDAQ', 'symbol': '^IXIC'},
                {'name': 'Russell 2000', 'symbol': '^RUT'}
            ]
            
            indices_data = []
            
            for index in indices:
                try:
                    stock = yf.Ticker(index['symbol'])
                    info = stock.info
                    
                    if info.get('regularMarketPrice'):
                        current_price = info.get('regularMarketPrice', 0)
                        previous_close = info.get('previousClose', 0)
                        change = current_price - previous_close
                        percent_change = (change / previous_close * 100) if previous_close > 0 else 0
                        
                        indices_data.append({
                            'name': index['name'],
                            'symbol': index['symbol'],
                            'value': round(current_price, 2),
                            'change': round(change, 2),
                            'percent_change': round(percent_change, 2)
                        })
                    else:
                        # Fallback if data not available
                        indices_data.append({
                            'name': index['name'],
                            'symbol': index['symbol'],
                            'value': 0,
                            'change': 0,
                            'percent_change': 0
                        })
                        
                except Exception as e:
                    print(f"Error fetching {index['symbol']}: {str(e)}")
                    # Add fallback data for this index
                    indices_data.append({
                        'name': index['name'],
                        'symbol': index['symbol'],
                        'value': 0,
                        'change': 0,
                        'percent_change': 0
                    })
            
            return jsonify({'indices': indices_data})
            
        except Exception as e:
            return jsonify({'error': f'Failed to fetch market indices: {str(e)}'}), 500

    @app.route('/portfolio/sector-breakdown', methods=['GET'])
    def get_sector_breakdown():
        """Get sector breakdown of current holdings"""
        try:
            portfolio = Portfolio.query.filter_by(id=1).first()
            if not portfolio:
                return jsonify({'error': 'Portfolio not found'}), 404
                
            holdings = Holding.query.filter_by(portfolio_id=portfolio.id).all()
            
            if not holdings:
                return jsonify({'sectors': []})
            
            # Calculate total portfolio value
            total_value = float(portfolio.cash_balance)
            sector_data = {}
            
            for holding in holdings:
                current_price = get_current_price(holding.ticker)
                market_value = float(holding.quantity) * current_price
                total_value += market_value
                
                # Get sector information for this stock
                try:
                    stock = yf.Ticker(holding.ticker)
                    info = stock.info
                    sector = info.get('sector', 'Unknown')
                    
                    if sector in sector_data:
                        sector_data[sector] += market_value
                    else:
                        sector_data[sector] = market_value
                        
                except Exception as e:
                    print(f"Error fetching sector for {holding.ticker}: {str(e)}")
                    # Use 'Unknown' sector if we can't get the data
                    if 'Unknown' in sector_data:
                        sector_data['Unknown'] += market_value
                    else:
                        sector_data['Unknown'] = market_value
            
            # Convert to percentages and format response
            sectors = []
            for sector, value in sector_data.items():
                if value > 0:  # Only include sectors with holdings
                    percentage = (value / total_value * 100) if total_value > 0 else 0
                    sectors.append({
                        'sector': sector,
                        'value': round(value, 2),
                        'percentage': round(percentage, 2)
                    })
            
            # Sort by percentage (highest first)
            sectors.sort(key=lambda x: x['percentage'], reverse=True)
            
            return jsonify({'sectors': sectors})
            
        except Exception as e:
            return jsonify({'error': f'Failed to get sector breakdown: {str(e)}'}), 500
            
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
            holding2 = Holding(portfolio_id=portfolio.id, ticker='GOOGL', quantity=Decimal('8'), cost_basis=Decimal('180.00'))
            holding3 = Holding(portfolio_id=portfolio.id, ticker='NFLX', quantity=Decimal('5'), cost_basis=Decimal('900.00'))
            holding4 = Holding(portfolio_id=portfolio.id, ticker='AMZN', quantity=Decimal('38'), cost_basis=Decimal('200.00'))
            holding5 = Holding(portfolio_id=portfolio.id, ticker='VOO', quantity=Decimal('6'), cost_basis=Decimal('305.00'))
            holding6 = Holding(portfolio_id=portfolio.id, ticker='MSFT', quantity=Decimal('29'), cost_basis=Decimal('520.00'))
            transaction = Transaction(portfolio_id=portfolio.id, ticker='AAPL', transaction_type='buy', price=Decimal('150.00'), quantity=Decimal('10'), transaction_date=datetime.now()- timedelta(days=1, hours=2))
            transaction2 = Transaction(portfolio_id=portfolio.id, ticker='NFLX', transaction_type='buy', price=Decimal('900.00'), quantity=Decimal('5'), transaction_date=datetime.now()- timedelta(days=4, hours=2))
            transaction3 = Transaction(portfolio_id=portfolio.id, ticker='MSFT', transaction_type='buy', price=Decimal('520.00'), quantity=Decimal('29'), transaction_date=datetime.now()- timedelta(days=6, hours=2))
            transaction4 = Transaction(portfolio_id=portfolio.id, ticker='AMZN', transaction_type='buy', price=Decimal('200.00'), quantity=Decimal('38'), transaction_date=datetime.now()- timedelta(days=9, hours=2))
            transaction5 = Transaction(portfolio_id=portfolio.id, ticker='VOO', transaction_type='buy', price=Decimal('305.00'), quantity=Decimal('6'), transaction_date=datetime.now()- timedelta(days=24, hours=2))
            transaction6 = Transaction(portfolio_id=portfolio.id, ticker='GOOGL', transaction_type='buy', price=Decimal('180.00'), quantity=Decimal('8'), transaction_date=datetime.now()- timedelta(days=37, hours=2))
            portfolio.cash_balance -= (transaction.price * transaction.quantity) + (transaction2.price * transaction2.quantity) + \
                                       (transaction3.price * transaction3.quantity) + (transaction4.price * transaction4.quantity) + \
                                       (transaction5.price * transaction5.quantity) + (transaction6.price * transaction6.quantity)
            db.session.add(holding)
            db.session.add(holding2)
            db.session.add(holding3)
            db.session.add(holding4)
            db.session.add(holding5)
            db.session.add(holding6)
            db.session.add(transaction)
            db.session.add(transaction2)
            db.session.add(transaction3)
            db.session.add(transaction4)
            db.session.add(transaction5)
            db.session.add(transaction6)
            db.session.commit()
            return jsonify({"message": "Database reset and default portfolio created.", "portfolio_id": portfolio.id}), 201