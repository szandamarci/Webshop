import hashlib
import pyodbc
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

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
                id INT IDENTITY(1,1) PRIMARY KEY,
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

        cursor.execute("SELECT COUNT(1) FROM Users WHERE user_email = ?", (email,))
        if cursor.fetchone()[0] > 0:
            return {'success': False, 'error': 'Ez az email már regisztrálva van.'}

        cursor.execute(
            "INSERT INTO Users (user_email, user_password, user_firstname, user_lastname) VALUES (?, ?, ?, ?)",
            (email, hashed, first_name, last_name)
        )
        conn.commit()

    return {'success': True}


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
            'lastName': last_name or ''
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


@app.route('/products', methods=['GET'])
def products_endpoint():
    # Ensure the Products table exists for dynamic demo. If not, create with basic fields.
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='Products')
            CREATE TABLE Products (
                id INT IDENTITY(1,1) PRIMARY KEY,
                prod_name NVARCHAR(255) NOT NULL,
                prod_price DECIMAL(18,2) NOT NULL,
                prod_image NVARCHAR(512) NULL
            )
            """
        )
        conn.commit()

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT prod_name, prod_price, prod_image FROM Products")
        rows = cursor.fetchall()

    products = []
    for row in rows:
        name, price, image = row
        products.append({
            'name': name,
            'price': float(price),
            'image': image or ''
        })

    return jsonify(products)


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


if __name__ == '__main__':
    print('Starting webshop database backend on http://localhost:5000')
    app.run(host='0.0.0.0', port=5000, debug=True)
