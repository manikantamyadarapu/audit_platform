import axios from 'axios';

const API_BASE = '/api/v1/process/section44ab';

/**
 * Validate Section 44AB Cash & Bank files
 * @param {File[]} cashFiles - Array of Cash ledger files
 * @param {File[]} bankFiles - Array of Bank ledger files
 * @returns {Promise<Object>} Section 44AB report results
 */
export async function validateSection44AB(cashFiles, bankFiles) {
  const formData = new FormData();

  cashFiles.forEach((file) => {
    formData.append('cash_files', file);
  });

  bankFiles.forEach((file) => {
    formData.append('bank_files', file);
  });

  const response = await axios.post(API_BASE, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}
