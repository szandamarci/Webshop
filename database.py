import hashlib
import json
import os
import pyodbc
from flask import Flask, request, jsonify
from flask_cors import CORS
import smtplib
import secrets
import urllib.error
import urllib.request
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

BARION_CONFIG = {
    'pos_key': os.getenv('BARION_POS_KEY', '').strip(),
    'payee': os.getenv('BARION_PAYEE', '').strip(),
    'api_base': os.getenv('BARION_API_BASE', 'https://api.test.barion.com').rstrip('/'),
    'frontend_base_url': os.getenv('FRONTEND_BASE_URL', 'http://localhost:5500').rstrip('/'),
    'backend_base_url': os.getenv('BACKEND_BASE_URL', 'http://localhost:5000').rstrip('/'),
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


def send_order_confirmation_email(email: str, items: list) -> bool:
    try:
        sender = EMAIL_CONFIG['sender_email']
        password = EMAIL_CONFIG['sender_password']

        safe_items = []
        total = 0.0
        for item in items:
            name = str(item.get('name', '')).strip()
            quantity = int(item.get('quantity', 0) or 0)
            price = float(item.get('price', 0) or 0)
            if not name or quantity <= 0 or price < 0:
                continue
            safe_items.append({'name': name, 'quantity': quantity, 'price': price})
            total += quantity * price

        items_text = '\n'.join(
            [f"- {it['name']}: {it['quantity']} x {it['price']:.2f} Ft" for it in safe_items]
        )
        items_html = ''.join(
            [
                f"<li>{it['name']} - {it['quantity']} x {it['price']:.2f} Ft</li>"
                for it in safe_items
            ]
        )

        if not sender or sender == 'your-email@gmail.com' or not password or password == 'your-app-password':
            print(f"[DEBUG] Email not configured. Would send order confirmation to {email}")
            return True

        message = MIMEMultipart('alternative')
        message['Subject'] = 'Webshop - Rendelés visszaigazolás'
        message['From'] = sender
        message['To'] = email

        text = f"""
Köszönjük a rendelésedet!

Rendelés összesítő:
{items_text if items_text else '-'}

Fizetendő végösszeg: {total:.2f} Ft
Fizetési mód: Utánvét

Üdvözlettel,
Webshop csapata
"""

        html = f"""
<html>
  <body>
    <h2>Köszönjük a rendelésedet!</h2>
    <p>Rendelés összesítő:</p>
    <ul>{items_html if items_html else '<li>-</li>'}</ul>
    <p><strong>Fizetendő végösszeg:</strong> {total:.2f} Ft</p>
    <p><strong>Fizetési mód:</strong> Utánvét</p>
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
    except Exception as error:
        print(f"Order confirmation email send error: {error}")
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


def ensure_orders_shipping_type_column_exists():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='Orders'")
        has_orders_table = cursor.fetchone()[0] > 0
        if not has_orders_table:
            return

        cursor.execute(
            """
            IF NOT EXISTS (
                SELECT 1
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME='Orders' AND COLUMN_NAME='shipping_type'
            )
            BEGIN
                ALTER TABLE [Orders] ADD shipping_type NVARCHAR(50) NULL;
            END
            """
        )

        cursor.execute(
            "SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Orders' AND COLUMN_NAME='shipping_method'"
        )
        has_legacy_shipping_method = cursor.fetchone()[0] > 0

        # SQL Server validates column names at parse time, so we only run this
        # statement when the legacy column actually exists.
        if has_legacy_shipping_method:
            cursor.execute(
                """
                UPDATE [Orders]
                SET shipping_type = shipping_method
                WHERE (shipping_type IS NULL OR LTRIM(RTRIM(shipping_type)) = '')
                  AND shipping_method IS NOT NULL;
                """
            )
        conn.commit()


def ensure_carts_tables_exist():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='Carts')
            CREATE TABLE Carts (
                id INT IDENTITY(1,1) PRIMARY KEY,
                user_id INT NULL,
                session_id NVARCHAR(255) NULL,
                status NVARCHAR(50) NOT NULL DEFAULT 'active',
                created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
            );

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='Cart_items')
            CREATE TABLE Cart_items (
                id INT IDENTITY(1,1) PRIMARY KEY,
                cart_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity INT NOT NULL,
                unit_price_snapshot FLOAT NOT NULL,
                created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
            );
            """
        )
        conn.commit()


def get_table_columns(cursor, table_name: str) -> dict:
    cursor.execute(
        """
        SELECT LOWER(COLUMN_NAME), LOWER(DATA_TYPE)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ?
        """,
        (table_name,)
    )
    rows = cursor.fetchall()
    return {row[0]: row[1] for row in rows}


def get_carts_columns(cursor):
    existing = get_table_columns(cursor, 'Carts')
    return {
        'existing': existing,
        'id': 'id' if 'id' in existing else None,
        'user_id': 'user_id' if 'user_id' in existing else None,
        'session_id': 'session_id' if 'session_id' in existing else None,
        'status': 'status' if 'status' in existing else None,
        'created_at': 'created_at' if 'created_at' in existing else None,
        'updated_at': 'updated_at' if 'updated_at' in existing else None,
        'session_type': existing.get('session_id')
    }


def get_cart_items_columns(cursor):
    existing = get_table_columns(cursor, 'Cart_items')
    return {
        'existing': existing,
        'id': 'id' if 'id' in existing else None,
        'cart_id': 'cart_id' if 'cart_id' in existing else None,
        'product_id': 'product_id' if 'product_id' in existing else None,
        'quantity': 'quantity' if 'quantity' in existing else None,
        'unit_price_snapshot': 'unit_price_snapshot' if 'unit_price_snapshot' in existing else None,
        'created_at': 'created_at' if 'created_at' in existing else ('crated_at' if 'crated_at' in existing else None),
        'updated_at': 'updated_at' if 'updated_at' in existing else None,
    }


def normalize_session_id_for_db(raw_session_id: str, data_type: str):
    session_id = str(raw_session_id or '').strip()
    if not session_id:
        return None

    data_type = (data_type or '').lower()
    if data_type in {'tinyint', 'smallint', 'int', 'bigint'}:
        digest = hashlib.md5(session_id.encode('utf-8')).hexdigest()[:8]
        value = int(digest, 16)
        if data_type == 'tinyint':
            return value % 255
        if data_type == 'smallint':
            return value % 32767
        if data_type == 'int':
            return value % 2147483647
        return value

    return session_id[:255]


def get_user_id_by_email(cursor, email: str):
    mail = (email or '').strip().lower()
    if not mail:
        return None

    cursor.execute("SELECT user_id FROM Users WHERE LOWER(user_email) = LOWER(?)", (mail,))
    row = cursor.fetchone()
    if not row:
        return None
    return int(row[0])


def get_product_id_by_name(cursor, product_name: str):
    name = (product_name or '').strip()
    if not name:
        return None

    ensure_products_table_exists()
    cols = get_products_columns(cursor)
    id_col = cols['id']
    name_col = cols['name']

    if not id_col or not name_col:
        return None

    cursor.execute(
        f"SELECT TOP 1 {id_col} FROM Products WHERE LOWER({name_col}) = LOWER(?) ORDER BY {id_col}",
        (name,)
    )
    row = cursor.fetchone()
    if not row:
        return None
    return int(row[0])


def get_or_create_active_cart(cursor, carts_cols: dict, user_id, session_id):
    id_col = carts_cols['id']
    status_col = carts_cols['status']
    user_col = carts_cols['user_id']
    session_col = carts_cols['session_id']

    if not id_col or not status_col:
        raise ValueError('A Carts tábla hiányos: id/status oszlop nem található.')

    if user_id and user_col:
        cursor.execute(
            f"SELECT TOP 1 {id_col} FROM Carts WHERE {status_col} = ? AND {user_col} = ? ORDER BY {id_col} DESC",
            ('active', user_id)
        )
        row = cursor.fetchone()
        if row:
            return int(row[0])

    elif session_id is not None and session_col:
        cursor.execute(
            f"SELECT TOP 1 {id_col} FROM Carts WHERE {status_col} = ? AND {session_col} = ? ORDER BY {id_col} DESC",
            ('active', session_id)
        )
        row = cursor.fetchone()
        if row:
            return int(row[0])

    columns = []
    values = []
    placeholders = []

    if user_col:
        columns.append(user_col)
        values.append(user_id)
        placeholders.append('?')

    if session_col:
        columns.append(session_col)
        values.append(session_id)
        placeholders.append('?')

    columns.append(status_col)
    values.append('active')
    placeholders.append('?')

    now = datetime.utcnow()
    if carts_cols['created_at']:
        columns.append(carts_cols['created_at'])
        values.append(now)
        placeholders.append('?')
    if carts_cols['updated_at']:
        columns.append(carts_cols['updated_at'])
        values.append(now)
        placeholders.append('?')

    cursor.execute(
        f"INSERT INTO Carts ({', '.join(columns)}) OUTPUT INSERTED.{id_col} VALUES ({', '.join(placeholders)})",
        values
    )
    row = cursor.fetchone()
    return int(row[0]) if (row and row[0] is not None) else 0


@app.route('/cart/items/sync', methods=['POST'])
def sync_cart_item_endpoint():
    data = request.get_json(force=True, silent=True) or {}

    item_name = str(data.get('itemName', '')).strip()
    user_email = str(data.get('userEmail', '')).strip().lower()
    raw_session_id = str(data.get('sessionId', '')).strip()
    quantity_raw = data.get('quantity', 0)
    unit_price_raw = data.get('unitPrice', 0)

    if not item_name:
        return jsonify({'success': False, 'error': 'itemName megadása kötelező.'}), 400

    try:
        quantity = int(quantity_raw)
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': 'quantity érvénytelen.'}), 400

    try:
        unit_price = float(unit_price_raw)
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': 'unitPrice érvénytelen.'}), 400

    if quantity < 0:
        return jsonify({'success': False, 'error': 'quantity nem lehet negatív.'}), 400

    if not user_email and not raw_session_id:
        return jsonify({'success': False, 'error': 'userEmail vagy sessionId megadása kötelező.'}), 400

    with get_connection() as conn:
        cursor = conn.cursor()
        ensure_users_table_exists()
        ensure_carts_tables_exist()

        carts_cols = get_carts_columns(cursor)
        cart_items_cols = get_cart_items_columns(cursor)
        if not cart_items_cols['cart_id'] or not cart_items_cols['product_id'] or not cart_items_cols['quantity']:
            return jsonify({'success': False, 'error': 'A Cart_items tábla hiányos.'}), 500

        product_id = get_product_id_by_name(cursor, item_name)
        if not product_id:
            return jsonify({'success': False, 'error': 'A termék nem található a Products táblában.'}), 404

        user_id = get_user_id_by_email(cursor, user_email) if user_email else None
        session_id = normalize_session_id_for_db(raw_session_id, carts_cols['session_type'])

        cart_id = get_or_create_active_cart(cursor, carts_cols, user_id, session_id)
        if not cart_id:
            return jsonify({'success': False, 'error': 'Nem sikerült aktív kosarat létrehozni.'}), 500

        cursor.execute(
            f"""
            SELECT TOP 1 {cart_items_cols['id']}
            FROM Cart_items
            WHERE {cart_items_cols['cart_id']} = ? AND {cart_items_cols['product_id']} = ?
            """,
            (cart_id, product_id)
        )
        existing_item = cursor.fetchone()

        now = datetime.utcnow()
        if quantity == 0:
            cursor.execute(
                f"DELETE FROM Cart_items WHERE {cart_items_cols['cart_id']} = ? AND {cart_items_cols['product_id']} = ?",
                (cart_id, product_id)
            )
        elif existing_item:
            updates = [
                f"{cart_items_cols['quantity']} = ?",
                f"{cart_items_cols['unit_price_snapshot']} = ?"
            ]
            params = [quantity, unit_price]

            if cart_items_cols['updated_at']:
                updates.append(f"{cart_items_cols['updated_at']} = ?")
                params.append(now)

            params.extend([cart_id, product_id])
            cursor.execute(
                f"UPDATE Cart_items SET {', '.join(updates)} WHERE {cart_items_cols['cart_id']} = ? AND {cart_items_cols['product_id']} = ?",
                params
            )
        else:
            insert_columns = [
                cart_items_cols['cart_id'],
                cart_items_cols['product_id'],
                cart_items_cols['quantity'],
                cart_items_cols['unit_price_snapshot']
            ]
            insert_values = [cart_id, product_id, quantity, unit_price]

            if cart_items_cols['created_at']:
                insert_columns.append(cart_items_cols['created_at'])
                insert_values.append(now)
            if cart_items_cols['updated_at']:
                insert_columns.append(cart_items_cols['updated_at'])
                insert_values.append(now)

            placeholders = ', '.join(['?'] * len(insert_columns))
            cursor.execute(
                f"INSERT INTO Cart_items ({', '.join(insert_columns)}) VALUES ({placeholders})",
                insert_values
            )

        if carts_cols['updated_at']:
            cursor.execute(f"UPDATE Carts SET {carts_cols['updated_at']} = ? WHERE {carts_cols['id']} = ?", (now, cart_id))

        conn.commit()

    return jsonify({'success': True, 'cartId': cart_id, 'productId': product_id, 'quantity': quantity}), 200


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


def call_barion_api(path: str, payload: dict) -> dict:
    url = f"{BARION_CONFIG['api_base']}{path}"
    encoded_payload = json.dumps(payload).encode('utf-8')
    request_obj = urllib.request.Request(
        url,
        data=encoded_payload,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )

    try:
        with urllib.request.urlopen(request_obj, timeout=20) as response:
            response_data = response.read().decode('utf-8')
            return json.loads(response_data) if response_data else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode('utf-8') if exc else ''
        try:
            parsed = json.loads(body) if body else {}
        except json.JSONDecodeError:
            parsed = {'raw': body}
        return {
            'Errors': [
                {
                    'Title': 'Barion HTTP error',
                    'Description': str(exc),
                    'Details': parsed
                }
            ]
        }
    except Exception as exc:
        return {
            'Errors': [
                {
                    'Title': 'Barion request failed',
                    'Description': str(exc)
                }
            ]
        }


def build_barion_items(raw_items: list) -> list:
    prepared = []
    for item in raw_items:
        name = str(item.get('name', '')).strip()
        quantity = int(item.get('quantity', 0) or 0)
        unit_price = float(item.get('price', 0) or 0)

        if not name or quantity <= 0 or unit_price < 0:
            continue

        prepared.append(
            {
                'Name': name,
                'Description': str(item.get('desc', name)).strip() or name,
                'Quantity': quantity,
                'Unit': 'db',
                'UnitPrice': unit_price,
                'ItemTotal': round(quantity * unit_price, 2),
                'SKU': str(item.get('sku', name)).strip()[:100],
                'Kind': 'Physical'
            }
        )

    return prepared


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


def format_datetime_for_json(value):
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.isoformat()

    return str(value)


def get_orders_columns(cursor):
    cursor.execute(
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME='Orders'
        ORDER BY ORDINAL_POSITION
        """
    )
    ordered_columns = [row[0] for row in cursor.fetchall()]
    existing_columns = {name.lower() for name in ordered_columns}

    return {
        'ordered': ordered_columns,
        'existing': existing_columns,
        'id': 'order_id' if 'order_id' in existing_columns else ('id' if 'id' in existing_columns else None),
        'cart_id': 'cart_id' if 'cart_id' in existing_columns else None,
        'user_id': 'user_id' if 'user_id' in existing_columns else None,
        'address': 'address' if 'address' in existing_columns else None,
        'order_date': 'order_date' if 'order_date' in existing_columns else None,
        'shipping_date': 'shipping_date' if 'shipping_date' in existing_columns else None,
        'order_state': 'order_state' if 'order_state' in existing_columns else None,
        'payment_type': 'payment_type' if 'payment_type' in existing_columns else None,
        'shipping_type': 'shipping_type' if 'shipping_type' in existing_columns else None,
        'payed': 'payed' if 'payed' in existing_columns else None,
    }


def get_admin_orders() -> list:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='Orders'")
        has_orders_table = cursor.fetchone()[0] > 0
        if not has_orders_table:
            return []

        cols = get_orders_columns(cursor)
        ordered_columns = cols.get('ordered', [])
        if not ordered_columns:
            return []

        select_parts = [f"o.[{column}] AS [{column}]" for column in ordered_columns]

        order_by_parts = []
        if cols['shipping_date']:
            order_by_parts.extend(
                [
                    f"CASE WHEN o.[{cols['shipping_date']}] IS NULL THEN 1 ELSE 0 END",
                    f"o.[{cols['shipping_date']}] ASC",
                ]
            )
        if cols['order_date']:
            order_by_parts.append(f"o.[{cols['order_date']}] ASC")
        if not order_by_parts:
            order_by_parts.append(f"o.[{ordered_columns[0]}] ASC")

        query = f"""
            SELECT {', '.join(select_parts)}
            FROM [Orders] o
            ORDER BY {', '.join(order_by_parts)}
        """

        cursor.execute(query)
        column_names = [column[0] for column in cursor.description]
        rows = cursor.fetchall()

    orders = []
    for row in rows:
        record = dict(zip(column_names, row))

        serialized_record = {}
        for key, value in record.items():
            serialized_record[key] = format_datetime_for_json(value)

        orders.append(serialized_record)

    return orders


@app.route('/create-payment/barion', methods=['POST'])
def create_barion_payment_endpoint():
    data = request.get_json(force=True, silent=True) or {}
    items = data.get('items', [])
    billing = data.get('billing', {})
    redirect_origin = str(data.get('redirectOrigin', '')).strip()

    if not isinstance(items, list) or not items:
        return jsonify({'success': False, 'error': 'A kosár üres vagy érvénytelen.'}), 400

    if not BARION_CONFIG['pos_key'] or not BARION_CONFIG['payee']:
        return jsonify(
            {
                'success': False,
                'error': 'Hiányzó Barion konfiguráció. Állítsd be a BARION_POS_KEY és BARION_PAYEE környezeti változókat.'
            }
        ), 500

    prepared_items = build_barion_items(items)
    if not prepared_items:
        return jsonify({'success': False, 'error': 'A kosár tételei érvénytelenek.'}), 400

    computed_total = round(sum(item['ItemTotal'] for item in prepared_items), 2)

    payer_email = str(billing.get('email', '')).strip()
    payer_name = f"{str(billing.get('firstName', '')).strip()} {str(billing.get('lastName', '')).strip()}".strip()

    frontend_base = redirect_origin.rstrip('/') if redirect_origin else BARION_CONFIG['frontend_base_url']
    redirect_url = f"{frontend_base}/payment.html?provider=barion"
    callback_url = f"{BARION_CONFIG['backend_base_url']}/payment/callback/barion"

    now_id = datetime.utcnow().strftime('%Y%m%d%H%M%S%f')
    payment_request = {
        'POSKey': BARION_CONFIG['pos_key'],
        'PaymentType': 'Immediate',
        'GuestCheckOut': True,
        'FundingSources': ['All'],
        'PaymentRequestId': f"ws-{now_id}",
        'PayerHint': payer_email,
        'PayerName': payer_name,
        'Currency': 'HUF',
        'RedirectUrl': redirect_url,
        'CallbackUrl': callback_url,
        'Locale': 'hu-HU',
        'Transactions': [
            {
                'POSTransactionId': f"txn-{now_id}",
                'Payee': BARION_CONFIG['payee'],
                'Total': computed_total,
                'Items': prepared_items,
            }
        ]
    }

    barion_response = call_barion_api('/v2/Payment/Start', payment_request)
    gateway_url = barion_response.get('GatewayUrl')
    payment_id = barion_response.get('PaymentId')

    if gateway_url and payment_id:
        return jsonify(
            {
                'success': True,
                'provider': 'barion',
                'paymentId': payment_id,
                'url': gateway_url,
            }
        ), 200

    return jsonify(
        {
            'success': False,
            'error': 'A Barion fizetés indítása sikertelen.',
            'details': barion_response,
        }
    ), 502


@app.route('/payment/callback/barion', methods=['POST'])
def payment_callback_barion_endpoint():
    data = request.get_json(force=True, silent=True) or {}
    payment_id = str(data.get('PaymentId', '')).strip()

    if not payment_id:
        return jsonify({'received': False, 'error': 'Missing PaymentId'}), 400

    payment_state = call_barion_api(
        '/v2/Payment/GetPaymentState',
        {
            'POSKey': BARION_CONFIG['pos_key'],
            'PaymentId': payment_id,
        }
    )

    print('Barion callback payment state:', payment_state)
    return jsonify({'received': True}), 200


@app.route('/payment/state/barion/<payment_id>', methods=['GET'])
def payment_state_barion_endpoint(payment_id: str):
    payment_id = (payment_id or '').strip()
    if not payment_id:
        return jsonify({'success': False, 'error': 'Hiányzó PaymentId.'}), 400

    if not BARION_CONFIG['pos_key']:
        return jsonify({'success': False, 'error': 'Hiányzó BARION_POS_KEY konfiguráció.'}), 500

    payment_state = call_barion_api(
        '/v2/Payment/GetPaymentState',
        {
            'POSKey': BARION_CONFIG['pos_key'],
            'PaymentId': payment_id,
        }
    )

    if payment_state.get('Errors'):
        return jsonify({'success': False, 'details': payment_state}), 502

    return jsonify({'success': True, 'state': payment_state}), 200


@app.route('/orders/afterpay/confirm', methods=['POST'])
def confirm_afterpay_order_endpoint():
    data = request.get_json(force=True, silent=True) or {}

    email = str(data.get('email', '')).strip().lower()
    user_email = str(data.get('userEmail', '')).strip().lower()
    address = str(data.get('address', '')).strip()
    payment_type = str(data.get('paymentType', 'Utánvét')).strip() or 'Utánvét'
    shipping_type = str(data.get('shippingMethod', 'standard')).strip().lower() or 'standard'
    order_state = str(data.get('orderState', 'Rögzítve')).strip() or 'Rögzítve'
    payed = parse_bool(data.get('payed', False), default=False)
    cart_id_input = data.get('cartId', None)
    items = data.get('items', [])

    if not email:
        return jsonify({'success': False, 'error': 'Email megadása kötelező.'}), 400

    if not address:
        return jsonify({'success': False, 'error': 'Cím megadása kötelező.'}), 400

    if not isinstance(items, list) or not items:
        return jsonify({'success': False, 'error': 'A kosár üres vagy érvénytelen.'}), 400

    owner_email = user_email if user_email else email

    with get_connection() as conn:
        cursor = conn.cursor()
        ensure_users_table_exists()
        ensure_orders_shipping_type_column_exists()

        cursor.execute("SELECT user_id FROM Users WHERE LOWER(user_email) = LOWER(?)", (owner_email,))
        user_row = cursor.fetchone()
        if not user_row:
            return jsonify({'success': False, 'error': 'A rendelés mentéséhez bejelentkezett felhasználó szükséges.'}), 400

        user_id = int(user_row[0])

        try:
            cart_id = int(cart_id_input) if cart_id_input is not None else 0
        except (TypeError, ValueError):
            cart_id = 0

        if cart_id <= 0:
            cursor.execute("SELECT ISNULL(MAX(cart_id), 0) + 1 FROM [Orders]")
            cart_id = int(cursor.fetchone()[0])

        order_date = datetime.now()
        shipping_date = order_date + timedelta(days=3)
        payed_bit = 1 if payed else 0

        cursor.execute(
            """
            INSERT INTO [Orders] (cart_id, user_id, address, order_date, shipping_date, order_state, payment_type, shipping_type, payed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (cart_id, user_id, address, order_date, shipping_date, order_state, payment_type, shipping_type, payed_bit)
        )
        cursor.execute("SELECT CAST(SCOPE_IDENTITY() AS INT)")
        order_id_row = cursor.fetchone()
        order_id = int(order_id_row[0]) if order_id_row and order_id_row[0] is not None else None
        conn.commit()

    sent = send_order_confirmation_email(email, items)
    if not sent:
        return jsonify({'success': True, 'orderId': order_id, 'emailSent': False, 'warning': 'Rendelés mentve, de a visszaigazoló email küldése sikertelen.'}), 200

    return jsonify({'success': True, 'orderId': order_id, 'emailSent': True}), 200


@app.route('/orders/admin', methods=['GET'])
def admin_orders_endpoint():
    requester_email = request.args.get('requester_email', '').strip().lower()
    if not is_admin_email(requester_email):
        return jsonify({'success': False, 'error': 'Nincs admin jogosultság ehhez a művelethez.'}), 403

    try:
        orders = get_admin_orders()
        return jsonify({'success': True, 'orders': orders}), 200
    except ValueError as error:
        return jsonify({'success': False, 'error': str(error)}), 500
    except Exception as error:
        return jsonify({'success': False, 'error': f'Rendelések betöltése sikertelen: {error}'}), 500


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


@app.route('/users/profile', methods=['GET'])
def user_profile_endpoint():
    email = request.args.get('email', '').strip().lower()
    if not email:
        return jsonify({'success': False, 'error': 'Email megadása kötelező.'}), 400

    with get_connection() as conn:
        cursor = conn.cursor()
        ensure_users_table_exists()

        cursor.execute(
            "SELECT user_email, user_firstname, user_lastname FROM Users WHERE user_email = ?",
            (email,)
        )
        row = cursor.fetchone()

    if not row:
        return jsonify({'success': False, 'error': 'Felhasználó nem található.'}), 404

    user_email, first_name, last_name = row
    return jsonify(
        {
            'success': True,
            'user': {
                'email': user_email or '',
                'firstName': first_name or '',
                'lastName': last_name or '',
            }
        }
    ), 200


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
