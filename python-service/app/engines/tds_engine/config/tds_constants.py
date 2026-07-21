"""TDS Rule Book constants and default seed data"""

from __future__ import annotations

# TDS Sections with their default rules
TDS_SECTIONS = [
    {
        'section': '194A',
        'description': 'Interest other than Interest on Securities',
        'threshold': 'Rs. 10,000 per annum',
        'rate': '10%',
        'rate_individual': None,
        'rate_others': None,
        'special_rule': None,
    },
    {
        'section': '194C',
        'description': 'Payments to resident contractor/sub-contractor',
        'threshold': 'Rs. 30,000 per transaction or Rs. 1,00,000 per annum',
        'rate': None,
        'rate_individual': '1%',
        'rate_others': '2%',
        'special_rule': None,
    },
    {
        'section': '194J(a)',
        'description': 'Fees for Technical Services',
        'threshold': 'Rs. 50,000 per annum',
        'rate': '2%',
        'rate_individual': None,
        'rate_others': None,
        'special_rule': None,
    },
    {
        'section': '194J(b)',
        'description': 'Fees for Professional Services',
        'threshold': 'Rs. 50,000 per annum',
        'rate': '10%',
        'rate_individual': None,
        'rate_others': None,
        'special_rule': None,
    },
    {
        'section': '194J(1)(ba)',
        'description': "Director's Remuneration",
        'threshold': 'No Threshold',
        'rate': '10%',
        'rate_individual': None,
        'rate_others': None,
        'special_rule': None,
    },
    {
        'section': '194I(a)',
        'description': 'Rent of Plant & Machinery',
        'threshold': 'Rs. 50,000 per month or part of a month',
        'rate': '2%',
        'rate_individual': None,
        'rate_others': None,
        'special_rule': None,
    },
    {
        'section': '194I(b)',
        'description': 'Rent of Land & Building',
        'threshold': 'Rs. 50,000 per month or part of a month',
        'rate': '10%',
        'rate_individual': None,
        'rate_others': None,
        'special_rule': None,
    },
    {
        'section': '194Q',
        'description': 'Purchase of goods from a resident seller (Buyer\'s turnover > Rs.10 Crore)',
        'threshold': 'Rs. 50,00,000 per annum',
        'rate': '0.1%',
        'rate_individual': None,
        'rate_others': None,
        'special_rule': 'If PAN is not available, use 5%',
    },
]

# Extract section codes for easier reference
TDS_SECTION_CODES = [rule['section'] for rule in TDS_SECTIONS]
