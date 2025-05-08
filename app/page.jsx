"use client"
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx'; // For parsing Excel files

const MAX_COMPOUNDS = 20; // Limit for compounds per request

export default function Home() {
  const [textareaValue, setTextareaValue] = useState(''); // For textarea input
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [percentage, setPercentage] = useState(95);
  const [result, setResult] = useState(null); // Will store the backend's JSON response object
  const [isLoading, setIsLoading] = useState(false);
  const [inputError, setInputError] = useState(''); // For frontend validation errors
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 20 }).map((_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: Math.random() * 3 + 1, delay: Math.random() * 5
    }));
    setParticles(newParticles);
  }, []);

  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ 
        content: e.target.result, 
        isBinary: !file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv' 
      });
      reader.onerror = (err) => reject(err);

      // Heuristic: read CSV as text, others as binary for XLSX
      if (file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv') {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file); // XLSX prefers binary string
      }
    });
  };

  const parseFileContent = (fileContent, isBinary, fileName) => {
    let smilesFromFile = [];
    try {
      // Primary attempt with XLSX for Excel and well-formed CSVs
      const workbook = XLSX.read(fileContent, { type: isBinary ? 'binary' : 'string' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("No sheets found in the Excel file.");
      const worksheet = workbook.Sheets[sheetName];
      const jsonSheet = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, blankrows: false });

      if (jsonSheet.length > 0) {
        let startIndex = 0;
        const firstCellFirstRow = String(jsonSheet[0][0] || "").trim().toLowerCase();
        // Basic header detection (if first cell of first row looks like a header and not a SMILES)
        if (jsonSheet.length > 1 && 
            (firstCellFirstRow.includes("smiles") || firstCellFirstRow.includes("compound")) &&
            firstCellFirstRow.length < 50 ) {
          startIndex = 1;
        }
        
        smilesFromFile = jsonSheet.slice(startIndex)
          .map(row => (row && row[0]) ? String(row[0]).trim() : "") // Get first cell, convert to string, trim
          .filter(s => s !== "" && s.length > 2); // Filter out empty strings and very short strings
      }
    } catch (error) {
      console.error("Error processing file with XLSX:", error);
      // Fallback for simple CSV if XLSX fails and it was read as text
      if (!isBinary && fileName.toLowerCase().endsWith('.csv')) { 
        console.log("Attempting fallback CSV parsing for:", fileName);
        const rows = fileContent.split(/\r?\n/); // Split by newline
        let startIndex = 0;
        if (rows.length > 0) {
          const firstCellFirstRow = rows[0].split(/[,;\t]/)[0].trim().toLowerCase();
          if (rows.length > 1 && 
              (firstCellFirstRow.includes("smiles") || firstCellFirstRow.includes("compound")) &&
              firstCellFirstRow.length < 50) {
            startIndex = 1;
          }
          smilesFromFile = rows.slice(startIndex)
            .map(row => row.split(/[,;\t]/)[0] ? row.split(/[,;\t]/)[0].trim() : "")
            .filter(s => s !== "" && s.length > 2);
        }
      } else {
        throw new Error("Could not parse the file. Ensure it's a valid Excel (xlsx, xls) or CSV with SMILES in the first column.");
      }
    }
    return smilesFromFile;
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file type
      const allowedTypes = ['.csv', '.xls', '.xlsx'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!allowedTypes.includes(fileExtension)) {
        setInputError('Invalid file type. Please upload a CSV or Excel file.');
        setSelectedFile(null);
        setFileName('');
        event.target.value = null; // Reset file input
        return;
      }
      setSelectedFile(file);
      setFileName(file.name);
      setTextareaValue(''); // Clear textarea when a file is selected
      setInputError('');
      setResult(null);
    } else {
      setSelectedFile(null);
      setFileName('');
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setResult(null); // Clear previous API results
    setInputError(''); // Clear previous input errors

    let smilesToProcess = [];

    if (selectedFile) {
      try {
        const fileData = await readFileContent(selectedFile);
        smilesToProcess = parseFileContent(fileData.content, fileData.isBinary, selectedFile.name);
        if (smilesToProcess.length === 0) {
          setInputError("No valid SMILES strings found in the uploaded file, or the file is empty/incorrectly formatted. Please check the file content (SMILES in the first column).");
          setIsLoading(false);
          return;
        }
      } catch (error) {
        setInputError(error.message || "Failed to process the uploaded file.");
        setIsLoading(false);
        return;
      }
    } else if (textareaValue.trim() !== "") {
      smilesToProcess = textareaValue.split(/[\n,]+/) // Split by newline or comma
        .map(s => s.trim())
        .filter(s => s !== ""); // Filter out empty strings
    }

    if (smilesToProcess.length === 0) {
      setInputError("Please enter SMILES strings in the textarea or upload a file.");
      setIsLoading(false);
      return;
    }

    if (smilesToProcess.length > MAX_COMPOUNDS) {
      setInputError(`Please limit your input to ${MAX_COMPOUNDS} compounds. You provided ${smilesToProcess.length}.`);
      setIsLoading(false);
      return;
    }

    try {
      const payload = {
        compound: smilesToProcess,
        percentage: Number(percentage)
      };
      
      // Ensure this URL and port matches your running Flask backend
      const res = await fetch('http://127.0.0.1:5328/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setResult({ error: data.error || `Server responded with ${res.status} ${res.statusText}` });
      } else {
        setResult(data); // Store the full JSON response from backend
      }
    } catch (err) {
      setResult({ error: `Network or Parsing Error: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };
  
  const clearInputs = () => {
    setTextareaValue('');
    setSelectedFile(null);
    setFileName('');
    setInputError('');
    setResult(null);
    // Reset the file input field visually
    const fileInput = document.getElementById('fileUpload');
    if (fileInput) {
      fileInput.value = null;
    }
  };


  return (
    <div className="relative min-h-screen bg-gray-900 overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id} className="absolute rounded-full bg-blue-400 opacity-20"
          style={{ width: `${particle.size}px`, height: `${particle.size}px`, left: `${particle.x}%`, top: `${particle.y}%`}}
          animate={{ y: [particle.y, particle.y - (Math.random() * 20 + 10), particle.y], x: [particle.x, particle.x + (Math.random() * 10 - 5), particle.x]}}
          transition={{ duration: 5 + particle.delay, repeat: Infinity, ease: "easeInOut"}}
        />
      ))}
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-14">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
            PKM2 Multi-Target Predictor
          </h1>
          <p className="text-xl text-gray-300">
            Classify compounds (max {MAX_COMPOUNDS}) and predict pIC50 for Activators of the PKM2 Protein.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
          className="bg-gray-800 bg-opacity-50 backdrop-blur-lg rounded-xl p-8 border border-gray-700 shadow-2xl">
          
          <div className="mb-6">
            <label htmlFor="smilesInput" className="block text-lg font-medium text-cyan-300 mb-2">
              Enter SMILES (comma or newline separated)
            </label>
            <textarea
              id="smilesInput"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-200 font-mono focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all h-32"
              placeholder={`e.g., C1=CC=CC=C1, O=C(N)C\nMax ${MAX_COMPOUNDS} compounds. Or upload a file below.`}
              value={textareaValue}
              onChange={(e) => { setTextareaValue(e.target.value); setSelectedFile(null); setFileName(''); setInputError(''); setResult(null);}}
              disabled={isLoading}
            />
          </div>

          <div className="text-center my-4 text-gray-400 text-sm">OR</div>

          <div className="mb-6">
            <label htmlFor="fileUpload" className="block text-lg font-medium text-cyan-300 mb-2">
              Upload File (Excel or CSV)
            </label>
            <input
              id="fileUpload"
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileChange}
              disabled={isLoading}
              className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-700 file:text-cyan-50 hover:file:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500 cursor-pointer"
            />
            {fileName && <p className="text-xs text-gray-400 mt-1">Selected file: {fileName}</p>}
            <p className="text-xs text-gray-500 mt-1">File should contain SMILES in the first column. Max {MAX_COMPOUNDS} compounds.</p>
          </div>
          
          {inputError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 p-3 bg-red-900 bg-opacity-50 rounded-lg text-red-300 text-sm">
              {inputError}
            </motion.div>
          )}

          <div className="mb-8">
            <label htmlFor="percentageSlider" className="block text-lg font-medium text-cyan-300 mb-2">
              Confidence Interval for Regression ({percentage}%)
            </label>
            <input
              id="percentageSlider" type="range" min="1" max="99" step="1" value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              disabled={isLoading}
              className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500"
            />
          </div>
          
          <div className="flex space-x-4">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSubmit}
              disabled={isLoading || (!textareaValue.trim() && !selectedFile)}
              className={`flex-grow py-4 px-6 rounded-lg font-bold text-lg transition-all ${isLoading || (!textareaValue.trim() && !selectedFile) ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:shadow-lg hover:shadow-cyan-500/20 text-white'}`}>
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Analyzing Molecules...</span>
                </div>
              ) : 'Predict Properties'}
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={clearInputs}
              disabled={isLoading}
              className="py-4 px-6 rounded-lg font-semibold text-sm bg-gray-600 hover:bg-gray-500 text-white transition-all">
              Clear Inputs
            </motion.button>
          </div>
        </motion.div>

        {/* Results Display Area */}
        {result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{delay:0.1}}
            className="mt-8 bg-gray-800 bg-opacity-50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
            
            {result.error && ( // Top-level error from API call itself
                <div className="p-4 bg-red-900 bg-opacity-50 rounded-lg text-red-300">
                    <h3 className="text-xl font-semibold text-red-200 mb-2">Error</h3>
                    <p>{result.error}</p>
                </div>
            )}

            {result.classification_results && (
              <>
                <h3 className="text-2xl font-semibold text-cyan-300 mb-4">Analysis Results</h3>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2"> {/* Scrollable results */}
                {Object.entries(result.classification_results).map(([smilesKey, classification]) => (
                  <div key={smilesKey} className="p-4 bg-gray-900 rounded-lg shadow-md border border-gray-700">
                    <p className="font-bold text-cyan-400 text-sm break-all">
                      Input: <span className="text-gray-200 font-mono">{smilesKey.startsWith("EMPTY_INPUT_") ? "(Empty Input)" : smilesKey}</span>
                    </p>
                    <p className="font-medium text-gray-300">
                      Classification: <span className={`font-semibold ${
                        classification === "Activator" ? "text-green-400" : 
                        classification === "Inhibitor" ? "text-orange-400" : 
                        classification === "Decoy" ? "text-blue-400" : "text-red-400"
                      }`}>{classification}</span>
                    </p>
                    
                    {result.regression_results && result.regression_results[smilesKey] && classification === "Activator" && (
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <p className="font-medium text-sm text-gray-400">Regression (pIC50):</p>
                        {result.regression_results[smilesKey].error ? (
                          <p className="text-xs text-red-400">{result.regression_results[smilesKey].error}</p>
                        ) : (
                          <>
                            <p className="text-xs text-gray-300">Median: {result.regression_results[smilesKey].regression_pIC50_median.toFixed(2)}</p>
                            <p className="text-xs text-gray-300">
                              {result.regression_results[smilesKey].confidence_interval_percentage}% CI: 
                              [{result.regression_results[smilesKey].regression_pIC50_lower_bound.toFixed(2)} - {result.regression_results[smilesKey].regression_pIC50_upper_bound.toFixed(2)}]
                            </p>
                            {result.regression_results[smilesKey].num_regression_models_used !== undefined && (
                               <p className="text-xs text-gray-500">(Based on {result.regression_results[smilesKey].num_regression_models_used} models)</p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                </div>
              </>
            )}

            {result.batch_processing_errors && result.batch_processing_errors.length > 0 && (
              <div className="mt-6">
                <h4 className="text-lg font-semibold text-red-400 mb-2">SMILES Processing Errors:</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
                {result.batch_processing_errors.map((err, index) => (
                  <div key={index} className="p-2 bg-red-900 bg-opacity-40 rounded text-xs">
                    <p className="text-red-300 break-all">
                        Input: "{err.smiles || err.input_smiles || "(unknown input)"}" <br/> Error: {err.error}
                    </p>
                  </div>
                ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>      
    </div>
  );
}