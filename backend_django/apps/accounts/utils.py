import random


def generate_token(length=6):
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])


def normalize_nisn(nisn):
    if not nisn:
        return ''
    nisn_str = str(nisn).strip()
    if nisn_str.startswith("'"):
        nisn_str = nisn_str[1:]
    return nisn_str
