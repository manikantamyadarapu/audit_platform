"""Output builder for Section 44AB Cash & Bank Audit."""

from typing import Any

from app.engines.section44ab_engine.parsers.workbook_loader import FileProcessingResult


def build_section44ab_response(
    cash_results: list[FileProcessingResult],
    bank_results: list[FileProcessingResult],
    load_ms: float,
) -> dict[str, Any]:
    """
    Build Section 44AB report response from processed file results.
    
    Args:
        cash_results: Results from Cash file processing
        bank_results: Results from Bank file processing
        load_ms: Total load time in milliseconds
    
    Returns:
        Dictionary with Section 44AB report structure
    """
    report_rows: list[dict[str, Any]] = []
    
    # Process Cash files
    cash_debit_total = 0.0
    cash_credit_total = 0.0
    
    for result in cash_results:
        if result.processing_status == 'success':
            cash_debit_total += result.debit_total
            cash_credit_total += result.credit_total
            
            report_rows.append({
                'accountName': result.account_name,
                'totalCashReceipts': result.debit_total,
                'tallyTotalReceipts': result.debit_total,
                'totalCashPayments': result.credit_total,
                'tallyTotalPayment': result.credit_total,
                'fileType': 'Cash',
                'fileName': result.file_name,
                'totalRows': result.total_data_rows,
                'openingBalanceRowsExcluded': result.opening_balance_rows_excluded,
            })
    
    # Process Bank files
    bank_debit_total = 0.0
    bank_credit_total = 0.0
    
    for result in bank_results:
        if result.processing_status == 'success':
            bank_debit_total += result.debit_total
            bank_credit_total += result.credit_total
            
            report_rows.append({
                'accountName': result.account_name,
                'totalCashReceipts': None,  # Blank for Bank
                'tallyTotalReceipts': result.debit_total,
                'totalCashPayments': None,  # Blank for Bank
                'tallyTotalPayment': result.credit_total,
                'fileType': 'Bank',
                'fileName': result.file_name,
                'totalRows': result.total_data_rows,
                'openingBalanceRowsExcluded': result.opening_balance_rows_excluded,
            })
    
    # Calculate grand totals
    grand_total_col2 = cash_debit_total  # Total Cash Receipts
    grand_total_col3 = cash_debit_total  # Tally Total Receipts (same for Cash)
    grand_total_col4 = cash_credit_total  # Total Cash Payments
    grand_total_col5 = cash_credit_total  # Tally Total Payment (same for Cash)
    
    # Add Bank totals to columns 3 and 5
    grand_total_col3 += bank_debit_total
    grand_total_col5 += bank_credit_total
    
    # Calculate percentages
    receipt_percentage = 0.0
    if grand_total_col3 > 0:
        receipt_percentage = (grand_total_col2 / grand_total_col3) * 100
    
    payment_percentage = 0.0
    if grand_total_col5 > 0:
        payment_percentage = (grand_total_col4 / grand_total_col5) * 100
    
    # Add TOTAL row
    report_rows.append({
        'accountName': 'TOTAL',
        'totalCashReceipts': grand_total_col2,
        'tallyTotalReceipts': grand_total_col3,
        'totalCashPayments': grand_total_col4,
        'tallyTotalPayment': grand_total_col5,
        'fileType': 'Total',
        'fileName': None,
        'totalRows': None,
        'openingBalanceRowsExcluded': None,
    })
    
    # Collect file-level errors
    file_errors: list[dict[str, Any]] = []
    for result in cash_results + bank_results:
        if result.processing_status == 'failed':
            file_errors.append({
                'fileName': result.file_name,
                'accountName': result.account_name,
                'errors': result.validation_errors,
            })
    
    return {
        'success': True,
        'reportRows': report_rows,
        'summary': {
            'cashFilesProcessed': len([r for r in cash_results if r.processing_status == 'success']),
            'cashFilesFailed': len([r for r in cash_results if r.processing_status == 'failed']),
            'bankFilesProcessed': len([r for r in bank_results if r.processing_status == 'success']),
            'bankFilesFailed': len([r for r in bank_results if r.processing_status == 'failed']),
            'totalCashReceipts': grand_total_col2,
            'tallyTotalReceipts': grand_total_col3,
            'totalCashPayments': grand_total_col4,
            'tallyTotalPayment': grand_total_col5,
            'receiptPercentage': receipt_percentage,
            'paymentPercentage': payment_percentage,
        },
        'fileErrors': file_errors,
        'processingStatistics': {
            'totalFiles': len(cash_results) + len(bank_results),
            'loadTimeMs': load_ms,
        },
        'executionTiming': {
            'loadMs': load_ms,
        },
    }
