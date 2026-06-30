
content = open('app.py', encoding='utf-8').read()

BAD_ROUTE_MARKER = "@app.route('/api/tickets/<int:id>', methods=['PATCH', 'OPTIONS'])\ndef patch_ticket(id):"

# Remove any trailing appended version
if BAD_ROUTE_MARKER in content:
    idx = content.find(BAD_ROUTE_MARKER)
    content = content[:idx]

GOOD_ROUTE = """
@app.route('/api/tickets/<int:ticket_id_patch>', methods=['PATCH', 'OPTIONS'])
def patch_ticket_dates(ticket_id_patch):
    if request.method == 'OPTIONS':
        return make_response('', 200)
    try:
        data = request.json
        start_date = data.get('start_date')
        end_date = data.get('end_date')

        if not start_date or not end_date:
            return jsonify({'error': 'Missing dates'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE tickets SET created_at = %s, due_date = %s WHERE ticket_id = %s',
            (start_date, end_date, ticket_id_patch)
        )
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        if 'conn' in locals(): conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()

"""

MAIN_MARKER = "if __name__ == '__main__':"
idx = content.find(MAIN_MARKER)
if idx == -1:
    print("ERROR: Could not find __main__ block")
else:
    final = content[:idx] + GOOD_ROUTE + content[idx:]
    open('app.py', 'w', encoding='utf-8').write(final)
    print("SUCCESS: PATCH route injected before __main__")
