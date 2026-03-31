#!/usr/bin/env python3
"""
Extract key data from GCD SQL dump and convert to JSON for the encyclopedia.
This script parses the SQL file and extracts publishers, series, characters, 
creators, and universes into a manageable JSON format.
"""

import re
import json
import sys
from collections import defaultdict

def parse_insert_statements(sql_content, table_name):
    """Parse INSERT statements for a given table and return list of rows."""
    pattern = rf"INSERT INTO `{table_name}` VALUES (.+?);"
    matches = re.finditer(pattern, sql_content, re.DOTALL)
    
    rows = []
    for match in matches:
        values_str = match.group(1)
        # Split by ),( to get individual rows
        value_groups = re.split(r'\),\(', values_str)
        
        for vg in value_groups:
            # Clean up parentheses
            vg = vg.strip().strip('()')
            # Parse values - handle quoted strings and numbers
            values = parse_values(vg)
            rows.append(values)
    
    return rows

def parse_values(values_str):
    """Parse individual values from a SQL values string."""
    values = []
    current = ''
    in_string = False
    string_char = None
    i = 0
    
    while i < len(values_str):
        char = values_str[i]
        
        if not in_string:
            if char in ("'", '"'):
                in_string = True
                string_char = char
                current += char
            elif char == ',':
                values.append(clean_value(current.strip()))
                current = ''
            elif char == 'N' and values_str[i:i+4] == 'NULL':
                values.append(None)
                i += 3  # Skip remaining NULL chars
            else:
                current += char
        else:
            current += char
            if char == string_char:
                # Check if it's escaped
                if i + 1 < len(values_str) and values_str[i + 1] == string_char:
                    current += values_str[i + 1]
                    i += 1
                else:
                    in_string = False
        i += 1
    
    if current.strip():
        values.append(clean_value(current.strip()))
    
    return values

def clean_value(val):
    """Clean a parsed value."""
    if val is None:
        return None
    val = str(val)
    # Remove surrounding quotes
    if (val.startswith("'") and val.endswith("'")) or (val.startswith('"') and val.endswith('"')):
        val = val[1:-1]
        # Unescape internal quotes
        val = val.replace("''", "'").replace('\\"', '"')
    return val

def extract_publishers(sql_content):
    """Extract publisher data."""
    print("Extracting publishers...")
    rows = parse_insert_statements(sql_content, 'gcd_publisher')
    publishers = []
    for row in rows:
        if len(row) >= 4:
            publishers.append({
                'id': int(row[0]) if row[0] else 0,
                'name': row[1] or 'Unknown',
                'is_comics_publisher': bool(row[2]) if row[2] is not None else False,
                'notes': row[3] or ''
            })
    print(f"  Found {len(publishers)} publishers")
    return publishers

def extract_series(sql_content):
    """Extract series data."""
    print("Extracting series...")
    rows = parse_insert_statements(sql_content, 'gcd_series')
    series_list = []
    for row in rows:
        if len(row) >= 8:
            series_list.append({
                'id': int(row[0]) if row[0] else 0,
                'name': row[1] or 'Unknown',
                'publisher_id': int(row[2]) if row[2] else None,
                'year_began': row[4] or '',
                'year_ended': row[5] or '',
                'is_comics_series': bool(row[7]) if row[7] is not None else False
            })
    print(f"  Found {len(series_list)} series")
    return series_list

def extract_characters(sql_content):
    """Extract character data."""
    print("Extracting characters...")
    rows = parse_insert_statements(sql_content, 'gcd_character')
    characters = []
    for row in rows:
        if len(row) >= 5:
            # gcd_character: id, modified, created, name, first_appearance
            characters.append({
                'id': int(row[0]) if row[0] else 0,
                'name': row[3] or 'Unknown',
                'first_appearance': row[4] or '' if len(row) > 4 else ''
            })
    print(f"  Found {len(characters)} characters")
    return characters

def extract_creators(sql_content):
    """Extract creator data."""
    print("Extracting creators...")
    rows = parse_insert_statements(sql_content, 'gcd_creator')
    creators = []
    for row in rows:
        if len(row) >= 5:
            creators.append({
                'id': int(row[0]) if row[0] else 0,
                'name': row[1] or 'Unknown',
                'birth_date': row[3] or '' if len(row) > 3 else '',
                'death_date': row[4] or '' if len(row) > 4 else ''
            })
    print(f"  Found {len(creators)} creators")
    return creators

def extract_universes(sql_content):
    """Extract universe data."""
    print("Extracting universes...")
    rows = parse_insert_statements(sql_content, 'gcd_universe')
    universes = []
    for row in rows:
        if len(row) >= 3:
            universes.append({
                'id': int(row[0]) if row[0] else 0,
                'name': row[1] or 'Unknown',
                'description': row[2] or ''
            })
    print(f"  Found {len(universes)} universes")
    return universes

def extract_groups(sql_content):
    """Extract group/team data."""
    print("Extracting groups...")
    rows = parse_insert_statements(sql_content, 'gcd_group')
    groups = []
    for row in rows:
        if len(row) >= 3:
            groups.append({
                'id': int(row[0]) if row[0] else 0,
                'name': row[1] or 'Unknown',
                'description': row[2] or ''
            })
    print(f"  Found {len(groups)} groups")
    return groups

def main():
    sql_file = 'Database/2026-03-29.sql'
    output_file = 'Database/encyclopedia_data.json'
    
    print(f"Reading SQL file: {sql_file}")
    print("This may take a while due to file size...")
    
    # Read file in chunks to find relevant sections
    # Since the file is huge, we'll use a streaming approach
    
    try:
        # For a 3.5GB file, we need to be smart about reading
        # We'll read line by line and only process relevant tables
        
        tables_to_extract = [
            'gcd_publisher',
            'gcd_series', 
            'gcd_character',
            'gcd_creator',
            'gcd_universe',
            'gcd_group'
        ]
        
        current_table = None
        table_data = defaultdict(list)
        
        print("Processing SQL file...")
        
        with open(sql_file, 'r', encoding='utf-8', errors='ignore') as f:
            buffer = ''
            line_count = 0
            
            for line in f:
                line_count += 1
                if line_count % 100000 == 0:
                    print(f"  Processed {line_count} lines...")
                
                # Check for CREATE TABLE or DROP TABLE to identify table context
                if 'DROP TABLE IF EXISTS' in line:
                    match = re.search(r'DROP TABLE IF EXISTS `(\w+)`', line)
                    if match:
                        current_table = match.group(1)
                        if current_table in tables_to_extract:
                            print(f"  Found table: {current_table}")
                        buffer = ''
                    continue
                
                # Skip if not a table we care about
                if current_table not in tables_to_extract:
                    continue
                
                # Accumulate INSERT statements
                if line.startswith('INSERT INTO'):
                    buffer += line.strip() + ' '
                    # Check if we have a complete statement
                    if buffer.rstrip().endswith(';'):
                        # Process the buffered INSERT statement
                        process_insert(buffer, current_table, table_data)
                        buffer = ''
                
                # Reset at UNLOCK TABLES or LOCK TABLES
                if 'UNLOCK TABLES' in line or ('LOCK TABLES' in line and current_table in tables_to_extract):
                    if buffer:
                        process_insert(buffer, current_table, table_data)
                        buffer = ''
                    if 'UNLOCK TABLES' in line:
                        current_table = None
        
        print("\nBuilding JSON output...")
        
        # Build the encyclopedia data structure
        encyclopedia_data = {
            'publishers': table_data.get('gcd_publisher', []),
            'series': table_data.get('gcd_series', []),
            'characters': table_data.get('gcd_character', []),
            'creators': table_data.get('gcd_creator', []),
            'universes': table_data.get('gcd_universe', []),
            'groups': table_data.get('gcd_group', []),
            'last_updated': '2026-03-29'
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(encyclopedia_data, f, indent=2, ensure_ascii=False)
        
        print(f"\nExtraction complete!")
        print(f"Output written to: {output_file}")
        
        # Print summary
        print("\nSummary:")
        print(f"  Publishers: {len(encyclopedia_data['publishers'])}")
        print(f"  Series: {len(encyclopedia_data['series'])}")
        print(f"  Characters: {len(encyclopedia_data['characters'])}")
        print(f"  Creators: {len(encyclopedia_data['creators'])}")
        print(f"  Universes: {len(encyclopedia_data['universes'])}")
        print(f"  Groups: {len(encyclopedia_data['groups'])}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

def process_insert(buffer, table_name, table_data):
    """Process a buffered INSERT statement."""
    try:
        pattern = rf"INSERT INTO `{table_name}` VALUES (.+?);"
        match = re.search(pattern, buffer, re.DOTALL)
        if not match:
            return
        
        values_str = match.group(1)
        value_groups = re.split(r'\),\(', values_str)
        
        for vg in value_groups:
            vg = vg.strip().strip('()')
            values = parse_values(vg)
            
            if table_name == 'gcd_publisher' and len(values) >= 4:
                table_data[table_name].append({
                    'id': int(values[0]) if values[0] else 0,
                    'name': values[1] or 'Unknown',
                    'is_comics_publisher': bool(values[2]) if values[2] is not None else False,
                    'notes': values[3] or ''
                })
            elif table_name == 'gcd_series' and len(values) >= 8:
                table_data[table_name].append({
                    'id': int(values[0]) if values[0] else 0,
                    'name': values[1] or 'Unknown',
                    'publisher_id': int(values[2]) if values[2] else None,
                    'year_began': values[4] or '',
                    'year_ended': values[5] or '',
                    'is_comics_series': bool(values[7]) if values[7] is not None else False
                })
            elif table_name == 'gcd_character' and len(values) >= 5:
                # The gcd_character table has: id, modified, created, name, first_appearance
                # values[1] is modified timestamp, values[3] is the actual name
                table_data[table_name].append({
                    'id': int(values[0]) if values[0] else 0,
                    'name': values[3] or 'Unknown',
                    'first_appearance': values[4] or '' if len(values) > 4 else ''
                })
            elif table_name == 'gcd_creator' and len(values) >= 5:
                table_data[table_name].append({
                    'id': int(values[0]) if values[0] else 0,
                    'name': values[1] or 'Unknown',
                    'birth_date': values[3] or '' if len(values) > 3 else '',
                    'death_date': values[4] or '' if len(values) > 4 else ''
                })
            elif table_name == 'gcd_universe' and len(values) >= 3:
                table_data[table_name].append({
                    'id': int(values[0]) if values[0] else 0,
                    'name': values[1] or 'Unknown',
                    'description': values[2] or ''
                })
            elif table_name == 'gcd_group' and len(values) >= 3:
                table_data[table_name].append({
                    'id': int(values[0]) if values[0] else 0,
                    'name': values[1] or 'Unknown',
                    'description': values[2] or ''
                })
    except Exception as e:
        print(f"  Warning: Error processing {table_name}: {e}")

if __name__ == '__main__':
    main()