#!/usr/bin/env python3
"""Fix character name/date swap in encyclopedia_data.json.

Some entries were loaded from GCD where `gcd_character` values were parsed incorrectly and
`name` became a timestamp (`modified` field) while `first_appearance` became the actual name.

This script updates those entries in-place.
"""

import re
import json
from pathlib import Path

DATA_PATH = Path(__file__).parent / 'encyclopedia_data.json'

DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?)?$")


def looks_like_datetime(value):
    return isinstance(value, str) and bool(DATETIME_RE.match(value.strip()))


def main():
    if not DATA_PATH.exists():
        print(f"Error: {DATA_PATH} not found")
        return

    with DATA_PATH.open('r', encoding='utf-8') as f:
        data = json.load(f)

    characters = data.get('characters', [])
    fixed = 0

    for char in characters:
        name = char.get('name', '')
        first_appearance = char.get('first_appearance', '')

        if looks_like_datetime(name) and first_appearance and not looks_like_datetime(first_appearance):
            char['name'] = first_appearance
            char['first_appearance'] = ''
            fixed += 1

    if fixed == 0:
        print('No broken character entries found.')
        return

    with DATA_PATH.open('w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f'Fixed {fixed} character entries in {DATA_PATH}')


if __name__ == '__main__':
    main()
