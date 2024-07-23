/**
 * Converts a column number to its corresponding letter(s).
 * @param {number} columnNumber - The column number.
 * @returns {string} - The corresponding column letter(s).
 */
function getColumnLetter(columnNumber) {
    let letter = '';
    while (columnNumber > 0) {
        const remainder = (columnNumber - 1) % 26;
        letter = String.fromCharCode(65 + remainder) + letter;
        columnNumber = Math.floor((columnNumber - 1) / 26);
    }
    return letter;
}

/**
 * Configures the progress for processing a range.
 * @param {Object} params - The parameters object.
 * @param {function(string): void} params.onError - The callback for handling errors.
 * @param {function(string, string): void} params.onSuccess - The callback for handling success.
 * @param {string} params.range - The range of cells to process.
 * @returns {Object} - The progress object with an update method.
 */
function configureProgress({ onError, onSuccess, range }) {
    const match = range.match(/([A-Z]+)(\d*):([A-Z]+)(\d*)/);

    const startRow = parseInt(match[2], 10);
    const endRow = parseInt(match[4], 10);
    const totalLines = endRow - startRow;
    let processedRows = totalLines;

    return {
        /**
         * Updates the progress.
         * @param {boolean} [stop=false] - Whether to stop the progress update.
         */
        update(stop = false) {
            if (stop) {
                const missingLines = totalLines - processedRows;
                processedRows = totalLines;
                return onError(`Stopped: ${missingLines}/${totalLines}`);
            }

            --processedRows;

            const missingLines = totalLines - processedRows;
            const color = missingLines === totalLines ? 'green' : 'blue';
            onSuccess(`${missingLines}/${totalLines}`, color);

            if (missingLines === totalLines) {
                processedRows = totalLines;
            }
        }
    };
}

module.exports = { getColumnLetter, configureProgress };
