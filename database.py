import hashlib
import pyodbc
from flask import Flask, request, jsonify
from flask_cors import CORS
import smtplib
import secrets
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

# Email configuration (modify these for your email setup)
EMAIL_CONFIG = {
    'smtp_server': 'smtp.gmail.com',
    'smtp_port': 587,
    'sender_email': 'fuszerfeszergrillgarazs@gmail.com',
    'sender_password': 'qyhq bfma jbzr dfvj'
}

ADMIN_EMAILS = {
    'admin@webshop.hu',
    'owner@webshop.hu',
    'marciszanda@gmail.com',
    'csaba.zsemlye@gmail.com',
    'zsadel2@gmail.com'
}

DB_CONFIG = {
    'driver': '{SQL Server}',
    'server': 'localhost\\SQLEXPRESS',
    'database': 'WebshopDB',
    'trusted_connection': 'yes'
}


def get_connection():
    conn_str = (
        f"DRIVER={DB_CONFIG['driver']};"
        f"SERVER={DB_CONFIG['server']};"
        f"DATABASE={DB_CONFIG['database']};"
        f"Trusted_Connection={DB_CONFIG['trusted_connection']};"
    )
    return pyodbc.connect(conn_str)


def hash_password(password: str, salt: str = None) -> str:
    if salt is None:
        salt = hashlib.sha256(str(hashlib.sha256(password.encode('utf-8')).hexdigest()).encode('utf-8')).hexdigest()[:16]
    digest = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
    return f"{salt}${digest}"


def ensure_users_table_exists():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='Users')
            CREATE TABLE Users (
                user_id INT IDENTITY(1,1) PRIMARY KEY,
                user_email NVARCHAR(255) NOT NULL UNIQUE,
                user_password NVARCHAR(512) NOT NULL,
                user_firstname NVARCHAR(100) NULL,
                user_lastname NVARCHAR(100) NULL,
                created_at DATETIME DEFAULT GETDATE()
            );

            IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'user_password')
            BEGIN
                ALTER TABLE Users ALTER COLUMN user_password NVARCHAR(512) NOT NULL;
            END

            IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'user_email')
            BEGIN
                ALTER TABLE Users ALTER COLUMN user_email NVARCHAR(255) NOT NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'user_firstname')
            BEGIN
                ALTER TABLE Users ADD user_firstname NVARCHAR(100) NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'user_lastname')
            BEGIN
                ALTER TABLE Users ADD user_lastname NVARCHAR(100) NULL;
            END
            """
        )
        conn.commit()


def ensure_pending_registrations_table_exists():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='PendingRegistrations')
            CREATE TABLE PendingRegistrations (
                pending_id INT IDENTITY(1,1) PRIMARY KEY,
                email NVARCHAR(255) NOT NULL UNIQUE,
                password_hash NVARCHAR(512) NOT NULL,
                verification_code NVARCHAR(50) NOT NULL,
                firstname NVARCHAR(100) NULL,
                lastname NVARCHAR(100) NULL,
                created_at DATETIME DEFAULT GETDATE(),
                expires_at DATETIME NOT NULL
            );
            """
        )
        conn.commit()


def send_verification_email(email: str, code: str) -> bool:
    try:
        sender = EMAIL_CONFIG['sender_email']
        password = EMAIL_CONFIG['sender_password']

        if not sender or sender == 'your-email@gmail.com' or not password or password == 'your-app-password':
            print(f"[DEBUG] Email not configured. Would send code {code} to {email}")
            return True

        message = MIMEMultipart('alternative')
        message['Subject'] = 'Webshop - Regisztráció megerősítése'
        message['From'] = sender
        message['To'] = email

        text = f"""
Üdvözlünk a Webshopban!

Az email-címed megerősítéséhez írd be az alábbi kódot:

{code}

A kód 30 percig érvényes.

Üdvözlettel,
Webshop csapata
"""

        html = f"""
<html>
  <body>
    <h2>Üdvözlünk a Webshopban!</h2>
    <p>Az email-címed megerősítéséhez írd be az alábbi kódot:</p>
    <h1 style="color: #333; font-size: 32px; letter-spacing: 2px;">{code}</h1>
    <p>A kód 30 percig érvényes.</p>
    <p>Üdvözlettel,<br>Webshop csapata</p>
  </body>
</html>
"""

        part1 = MIMEText(text, 'plain')
        part2 = MIMEText(html, 'html')
        message.attach(part1)
        message.attach(part2)

        with smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port']) as server:
            server.starttls()
            server.login(sender, password)
            server.sendmail(sender, email, message.as_string())

        return True
    except Exception as e:
        print(f"Email send error: {e}")
        return False


def ensure_products_table_exists():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='Products')
            CREATE TABLE Products (
                prod_id INT IDENTITY(1,1) PRIMARY KEY,
                prod_name NVARCHAR(255) NOT NULL,
                prod_price FLOAT NOT NULL,
                prod_image NVARCHAR(512) NULL,
                prod_category NVARCHAR(100) NULL,
                prod_sale BIT NOT NULL DEFAULT 0
            );
            """
        )
        # Add missing columns if table already exists
        cursor.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Products'")
        existing_columns = {row[0].lower() for row in cursor.fetchall()}

        if 'prod_image' not in existing_columns:
            cursor.execute("ALTER TABLE Products ADD prod_image NVARCHAR(512) NULL")

        if 'prod_category' not in existing_columns:
            cursor.execute("ALTER TABLE Products ADD prod_category NVARCHAR(100) NULL")

        if 'prod_sale' not in existing_columns:
            cursor.execute("ALTER TABLE Products ADD prod_sale BIT NOT NULL DEFAULT 0")

        conn.commit()


def is_admin_email(email: str) -> bool:
    return (email or '').strip().lower() in ADMIN_EMAILS


def parse_bool(value, default: bool = False) -> bool:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return value != 0

    text = str(value).strip().lower()
    if text in {'1', 'true', 'yes', 'on'}:
        return True
    if text in {'0', 'false', 'no', 'off'}:
        return False

    return default


def get_products_columns(cursor):
    cursor.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Products'")
    existing_columns = {row[0].lower() for row in cursor.fetchall()}

    return {
        'existing': existing_columns,
        'id': 'prod_id' if 'prod_id' in existing_columns else ('id' if 'id' in existing_columns else None),
        'name': 'prod_name' if 'prod_name' in existing_columns else ('name' if 'name' in existing_columns else None),
        'price': 'prod_price' if 'prod_price' in existing_columns else ('price' if 'price' in existing_columns else None),
        'image': 'prod_image' if 'prod_image' in existing_columns else ('image' if 'image' in existing_columns else None),
        'category': 'prod_category' if 'prod_category' in existing_columns else ('category' if 'category' in existing_columns else None),
        'sale': 'prod_sale' if 'prod_sale' in existing_columns else ('sale' if 'sale' in existing_columns else None)
    }


def get_products(category: str = None) -> list:
    ensure_products_table_exists()

    with get_connection() as conn:
        cursor = conn.cursor()
        cols = get_products_columns(cursor)
        name_col = cols['name']
        price_col = cols['price']
        id_col = cols['id']
        image_col = cols['image']
        category_col = cols['category']
        sale_col = cols['sale']

        if not name_col or not price_col:
            raise ValueError('Products table must contain prod_name/name and prod_price/price columns.')

        selected_columns = []
        if id_col:
            selected_columns.append(id_col)
        selected_columns.extend([name_col, price_col])
        if image_col:
            selected_columns.append(image_col)
        if category_col:
            selected_columns.append(category_col)
        if sale_col:
            selected_columns.append(sale_col)

        order_by = id_col if id_col else name_col

        query = f"SELECT {', '.join(selected_columns)} FROM Products"
        params = []

        if category:
            if category_col:
                query += f" WHERE LOWER({category_col}) = LOWER(?)"
                params.append(category)

        query += f" ORDER BY {order_by}"

        cursor.execute(query, params)
        rows = cursor.fetchall()

    products = []
    for r in rows:
        idx = 0
        prod_id = None
        if id_col:
            prod_id = r[idx]
            idx += 1

        product = {
            'prod_id': int(prod_id) if prod_id is not None else None,
            'prod_name': r[idx],
            'prod_price': float(r[idx + 1]),
            'prod_image': ''
        }
        idx += 2

        if image_col:
            product['prod_image'] = r[idx] if r[idx] is not None else ''
            idx += 1

        if category_col:
            product['prod_category'] = r[idx] if r[idx] is not None else ''
            idx += 1
        else:
            product['prod_category'] = ''

        if sale_col:
            product['prod_sale'] = bool(r[idx]) if r[idx] is not None else False
        else:
            product['prod_sale'] = False

        # if image path is relative filename, prefix assets/products/
        if product['prod_image'] and not product['prod_image'].lower().startswith('http') and not product['prod_image'].startswith('/'):
            product['prod_image'] = 'assets/products/' + product['prod_image']

        products.append(product)

    return products


def register_user(email: str, password: str, first_name: str = '', last_name: str = '') -> dict:
    email = email.strip().lower()
    first_name = first_name.strip()
    last_name = last_name.strip()

    if not email or not password:
        return {'success': False, 'error': 'Email és jelszó megadása kötelező.'}
    if len(password) < 6:
        return {'success': False, 'error': 'A jelszónak legalább 6 karakter hosszúnak kell lennie.'}

    hashed = hash_password(password)
    with get_connection() as conn:
        cursor = conn.cursor()
        ensure_users_table_exists()
        ensure_pending_registrations_table_exists()

        cursor.execute("SELECT COUNT(1) FROM Users WHERE user_email = ?", (email,))
        if cursor.fetchone()[0] > 0:
            return {'success': False, 'error': 'Ez az email már regisztrálva van.'}

        cursor.execute("SELECT COUNT(1) FROM PendingRegistrations WHERE email = ?", (email,))
        if cursor.fetchone()[0] > 0:
            cursor.execute("DELETE FROM PendingRegistrations WHERE email = ?", (email,))
            conn.commit()

        verification_code = secrets.token_hex(3).upper()
        expires_at = datetime.now() + timedelta(minutes=30)

        cursor.execute(
            "INSERT INTO PendingRegistrations (email, password_hash, verification_code, firstname, lastname, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
            (email, hashed, verification_code, first_name, last_name, expires_at)
        )
        conn.commit()

    email_sent = send_verification_email(email, verification_code)
    if not email_sent:
        return {'success': False, 'error': 'Nem sikerült elküldeni az ellenőrzési emailt. Próbáld később.'}

    return {'success': True, 'message': 'Ellenőrzési kód elküldve az email-címedre.'}


def verify_password(stored_hash: str, password: str) -> bool:
    try:
        salt, digest = stored_hash.split('$', 1)
    except ValueError:
        return False
    return hashlib.sha256((salt + password).encode('utf-8')).hexdigest() == digest


def login_user(email: str, password: str) -> dict:
    email = email.strip().lower()
    if not email or not password:
        return {'success': False, 'error': 'Email és jelszó megadása kötelező.'}

    with get_connection() as conn:
        cursor = conn.cursor()
        ensure_users_table_exists()

        cursor.execute("SELECT user_password, user_firstname, user_lastname FROM Users WHERE user_email = ?", (email,))
        row = cursor.fetchone()
        if not row:
            return {'success': False, 'error': 'Érvénytelen email vagy jelszó.'}

        stored_hash, first_name, last_name = row
        if not verify_password(stored_hash, password):
            return {'success': False, 'error': 'Érvénytelen email vagy jelszó.'}

    return {
        'success': True,
        'user': {
            'email': email,
            'firstName': first_name or '',
            'lastName': last_name or '',
            'isAdmin': is_admin_email(email)
        }
    }


@app.route('/register', methods=['POST'])
def register_endpoint():
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({'success': False, 'error': 'A kérés nem tartalmaz JSON payloadot.'}), 400

    email = data.get('email', '').strip()
    password = data.get('password', '')
    confirm = data.get('confirmPassword', '')

    if password != confirm:
        return jsonify({'success': False, 'error': 'A jelszó és a megerősítés nem egyezik.'}), 400

    first_name = data.get('firstName', '').strip()
    last_name = data.get('lastName', '').strip()

    result = register_user(email, password, first_name, last_name)
    status = 201 if result.get('success') else 400
    return jsonify(result), status


@app.route('/verify-email', methods=['POST'])
def verify_email_endpoint():
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({'success': False, 'error': 'A kérés nem tartalmaz JSON payloadot.'}), 400

    email = data.get('email', '').strip().lower()
    code = data.get('code', '').strip().upper()

    if not email or not code:
        return jsonify({'success': False, 'error': 'Email és kód megadása kötelező.'}), 400

    with get_connection() as conn:
        cursor = conn.cursor()
        ensure_pending_registrations_table_exists()
        ensure_users_table_exists()

        cursor.execute(
            "SELECT password_hash, firstname, lastname, expires_at FROM PendingRegistrations WHERE email = ? AND verification_code = ?",
            (email, code)
        )
        row = cursor.fetchone()

        if not row:
            return jsonify({'success': False, 'error': 'Érvénytelen kód vagy email.'}), 400

        password_hash, first_name, last_name, expires_at = row

        if expires_at < datetime.now():
            cursor.execute("DELETE FROM PendingRegistrations WHERE email = ?", (email,))
            conn.commit()
            return jsonify({'success': False, 'error': 'A kód lejárt. Kérjük próbálj meg újra regisztrálni.'}), 400

        cursor.execute(
            "INSERT INTO Users (user_email, user_password, user_firstname, user_lastname) VALUES (?, ?, ?, ?)",
            (email, password_hash, first_name or '', last_name or '')
        )

        cursor.execute("DELETE FROM PendingRegistrations WHERE email = ?", (email,))
        conn.commit()

    return jsonify({'success': True, 'message': 'Email sikeresen megerősítve. Bejelentkezhetsz.'}), 201


@app.route('/login', methods=['POST'])
def login_endpoint():
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({'success': False, 'error': 'A kérés nem tartalmaz JSON payloadot.'}), 400

    email = data.get('email', '').strip()
    password = data.get('password', '')

    result = login_user(email, password)
    status = 200 if result.get('success') else 401
    return jsonify(result), status


@app.route('/products', methods=['GET'])
def products_endpoint():
    category = request.args.get('category', '').strip()
    products = get_products(category if category else None)
    return jsonify({'success': True, 'products': products}), 200


@app.route('/products', methods=['POST'])
def add_product_endpoint():
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({'success': False, 'error': 'A kérés nem tartalmaz JSON payloadot.'}), 400

    requester_email = data.get('requester_email', '').strip().lower()
    if not is_admin_email(requester_email):
        return jsonify({'success': False, 'error': 'Nincs admin jogosultság ehhez a művelethez.'}), 403

    name = data.get('prod_name', '').strip()
    price = data.get('prod_price', None)
    image = data.get('prod_image', '').strip()
    category = data.get('prod_category', '').strip()
    sale = parse_bool(data.get('prod_sale', False), default=False)

    if not name or price is None:
        return jsonify({'success': False, 'error': 'prod_name és prod_price kötelező.'}), 400

    try:
        price_val = float(price)
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': 'prod_price érvénytelen.'}), 400

    with get_connection() as conn:
        cursor = conn.cursor()
        ensure_products_table_exists()
        cols = get_products_columns(cursor)

        name_col = cols['name']
        price_col = cols['price']
        image_col = cols['image']
        category_col = cols['category']
        sale_col = cols['sale']

        if not name_col or not price_col:
            return jsonify({'success': False, 'error': 'A Products tábla hiányos: név/ár oszlop nem található.'}), 500

        insert_columns = [name_col, price_col]
        insert_values = [name, price_val]

        if image_col:
            insert_columns.append(image_col)
            insert_values.append(image if image else None)

        if category_col:
            insert_columns.append(category_col)
            insert_values.append(category if category else None)

        if sale_col:
            sale_val = 1 if sale else 0
            insert_columns.append(sale_col)
            insert_values.append(sale_val)

        placeholders = ', '.join(['?'] * len(insert_columns))
        cursor.execute(
            f"INSERT INTO Products ({', '.join(insert_columns)}) VALUES ({placeholders})",
            insert_values
        )
        conn.commit()

    return jsonify({'success': True}), 201


@app.route('/products/<int:prod_id>', methods=['PUT'])
def update_product_endpoint(prod_id: int):
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({'success': False, 'error': 'A kérés nem tartalmaz JSON payloadot.'}), 400

    requester_email = data.get('requester_email', '').strip().lower()
    if not is_admin_email(requester_email):
        return jsonify({'success': False, 'error': 'Nincs admin jogosultság ehhez a művelethez.'}), 403

    prod_name = data.get('prod_name', None)
    prod_image = data.get('prod_image', None)
    prod_category = data.get('prod_category', None)
    prod_sale = data.get('prod_sale', None)
    price = data.get('prod_price', None)

    with get_connection() as conn:
        cursor = conn.cursor()
        ensure_products_table_exists()
        cols = get_products_columns(cursor)

        id_col = cols['id']
        name_col = cols['name']
        price_col = cols['price']
        image_col = cols['image']
        category_col = cols['category']
        sale_col = cols['sale']

        if not id_col:
            return jsonify({'success': False, 'error': 'A Products tábla hiányos: azonosító oszlop nem található.'}), 500

        updates = []
        params = []

        if prod_name is not None:
            if not name_col:
                return jsonify({'success': False, 'error': 'A Products tábla hiányos: név oszlop nem található.'}), 500

            name_val = str(prod_name).strip()
            if not name_val:
                return jsonify({'success': False, 'error': 'prod_name nem lehet üres.'}), 400

            updates.append(f"{name_col} = ?")
            params.append(name_val)

        if price is not None:
            if not price_col:
                return jsonify({'success': False, 'error': 'A Products tábla hiányos: ár oszlop nem található.'}), 500

            try:
                price_val = float(price)
            except (TypeError, ValueError):
                return jsonify({'success': False, 'error': 'prod_price érvénytelen.'}), 400

            updates.append(f"{price_col} = ?")
            params.append(price_val)

        if prod_image is not None:
            if not image_col:
                return jsonify({'success': False, 'error': 'A Products tábla hiányos: kép oszlop nem található.'}), 500

            image_val = str(prod_image).strip() if prod_image is not None else ''
            updates.append(f"{image_col} = ?")
            params.append(image_val if image_val else None)

        if prod_category is not None:
            if not category_col:
                return jsonify({'success': False, 'error': 'A Products tábla hiányos: kategória oszlop nem található.'}), 500

            category_val = str(prod_category).strip() if prod_category is not None else ''
            updates.append(f"{category_col} = ?")
            params.append(category_val if category_val else None)

        if prod_sale is not None:
            if not sale_col:
                return jsonify({'success': False, 'error': 'A Products tábla hiányos: sale oszlop nem található.'}), 500

            sale_val = 1 if parse_bool(prod_sale, default=False) else 0
            updates.append(f"{sale_col} = ?")
            params.append(sale_val)

        if not updates:
            return jsonify({'success': False, 'error': 'Nincs frissítendő mező.'}), 400

        params.append(prod_id)
        cursor.execute(
            f"UPDATE Products SET {', '.join(updates)} WHERE {id_col} = ?",
            params
        )

        if cursor.rowcount == 0:
            return jsonify({'success': False, 'error': 'A termék nem található.'}), 404

        conn.commit()

    return jsonify({'success': True}), 200


@app.route('/products/<int:prod_id>', methods=['DELETE'])
def delete_product_endpoint(prod_id: int):
    requester_email = request.args.get('requester_email', '').strip().lower()
    if not is_admin_email(requester_email):
        return jsonify({'success': False, 'error': 'Nincs admin jogosultság ehhez a művelethez.'}), 403

    with get_connection() as conn:
        cursor = conn.cursor()
        ensure_products_table_exists()
        cols = get_products_columns(cursor)

        id_col = cols['id']
        if not id_col:
            return jsonify({'success': False, 'error': 'A Products tábla hiányos: azonosító oszlop nem található.'}), 500

        cursor.execute(f"DELETE FROM Products WHERE {id_col} = ?", (prod_id,))

        if cursor.rowcount == 0:
            return jsonify({'success': False, 'error': 'A termék nem található.'}), 404

        conn.commit()

    return jsonify({'success': True}), 200


if __name__ == '__main__':
    print('Starting webshop database backend on http://localhost:5000')
    app.run(host='0.0.0.0', port=5000, debug=True)
