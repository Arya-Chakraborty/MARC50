"use client"
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx'; // For parsing Excel files
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';

// --- Configuration ---
const MAX_COMPOUNDS = 20;
const API_URL = 'http://127.0.0.1:5328/api/predict'; // Ensure this matches your backend

// --- Helper Components / Icons ---
const IconSun = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-6.364-.386l1.591-1.591M3 12h2.25m.386-6.364l1.591 1.591" />
  </svg>
);

const IconMoon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
  </svg>
);

const IconUpload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

const CHART_COLORS = {
  Activator: '#10B981', // Emerald-500
  Inhibitor: '#F59E0B', // Amber-500
  Decoy: '#3B82F6',     // Blue-500
  Error: '#EF4444',     // Red-500
};

// Define the order for sorting
const TYPE_ORDER = {
  'Activator': 1,
  'Inhibitor': 2,
  'Decoy': 3,
  'Error': 4
};

export default function Home() {
  const [textareaValue, setTextareaValue] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [percentage, setPercentage] = useState(95);
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputError, setInputError] = useState('');
  const [theme, setTheme] = useState('dark');
  const [tableData, setTableData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [particles, setParticles] = useState([]); // Particle state from original code

  // Particle effect from original code
  useEffect(() => {
    const newParticles = Array.from({ length: 30 }).map((_, i) => ({ // Increased particle count
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: Math.random() * 2.5 + 0.5, // Slightly smaller max size
      delay: Math.random() * 7 + 3, // Longer, more varied delays
      duration: Math.random() * 10 + 10 // Longer, more varied durations
    }));
    setParticles(newParticles);
  }, []);


  useEffect(() => {
    // Initialize theme from localStorage or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Transform results for table and chart
  useEffect(() => {
    if (results && results.classification_results) {
      // Convert results to table data first
      const newTableData = Object.entries(results.classification_results).map(([smiles, classification]) => {
        let AC50Display = 'N/A';
        let rawPurityData = {};

        if (classification === 'Activator' && results.regression_results && results.regression_results[smiles]) {
          const regData = results.regression_results[smiles];
          if (regData.error) {
            AC50Display = regData.error;
          } else {
            AC50Display = `${regData.regression_AC50_median.toFixed(2)} [${regData.regression_AC50_lower_bound.toFixed(2)} – ${regData.regression_AC50_upper_bound.toFixed(2)}] (${regData.confidence_interval_percentage}%)`;
            rawPurityData = {
              median: regData.regression_AC50_median,
              lower: regData.regression_AC50_lower_bound,
              upper: regData.regression_AC50_upper_bound,
              ci_percentage: regData.confidence_interval_percentage,
              models_used: regData.num_regression_models_used
            };
          }
        }
        return {
          smiles: smiles.startsWith("EMPTY_INPUT_") ? "(Empty Input)" : smiles,
          type: classification,
          AC50: AC50Display,
          _rawPurityData: rawPurityData // For potential future use (e.g. sorting, filtering)
        };
      });

      // Sort table data by type (Activator -> Inhibitor -> Decoy -> Error)
      newTableData.sort((a, b) => {
        const orderA = TYPE_ORDER[a.type] || 999;
        const orderB = TYPE_ORDER[b.type] || 999;
        return orderA - orderB;
      });
      setTableData(newTableData);

      // Prepare chart data
      const counts = { Activator: 0, Inhibitor: 0, Decoy: 0, Error: 0 };
      Object.values(results.classification_results).forEach(classification => {
        if (counts[classification] !== undefined) {
          counts[classification]++;
        } else if (String(classification).toLowerCase().includes("error")) {
          counts.Error++;
        } else {
          // Map any other classifications to Decoy
          counts.Decoy = (counts.Decoy || 0) + 1;
        }
      });
      
      const newChartData = Object.entries(counts)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));
      setChartData(newChartData);

    } else {
      setTableData([]);
      setChartData([]);
    }
  }, [results]);


  const readFileContent = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ 
        content: e.target.result, 
        isBinary: !file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv' 
      });
      reader.onerror = (err) => reject(new Error(`File reading error: ${err.message}`));
      
      if (file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv') {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    });
  }, []);

  const parseFileContent = useCallback((fileContent, isBinary, fileName) => {
    let smilesFromFile = [];
    try {
      const workbook = XLSX.read(fileContent, { type: isBinary ? 'binary' : 'string', cellNF: false, cellDates: false });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("No sheets found in the file.");
      const worksheet = workbook.Sheets[sheetName];
      const jsonSheet = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, blankrows: false });

      if (jsonSheet.length > 0) {
        let startIndex = 0;
        const firstRowFirstCell = String(jsonSheet[0][0] || "").trim().toLowerCase();
        if (jsonSheet.length > 1 && 
            (firstRowFirstCell.includes("smiles") || firstRowFirstCell.includes("compound") || firstRowFirstCell.includes("molecule")) &&
            firstRowFirstCell.length < 50) {
          startIndex = 1;
        }
        
        smilesFromFile = jsonSheet.slice(startIndex)
          .map(row => (row && row[0]) ? String(row[0]).trim() : "")
          .filter(s => s && s.length > 2 && !s.toLowerCase().includes("smiles") && !s.toLowerCase().includes("compound")); // More robust filtering
      }
    } catch (error) {
      console.error("Error processing file with XLSX:", error);
      if (!isBinary && fileName.toLowerCase().endsWith('.csv')) { 
        const rows = fileContent.split(/\r?\n/);
        let startIndex = 0;
        if (rows.length > 0) {
          const firstRowFirstCell = rows[0].split(/[,;\t]/)[0].trim().toLowerCase();
          if (rows.length > 1 && 
              (firstRowFirstCell.includes("smiles") || firstRowFirstCell.includes("compound") || firstRowFirstCell.includes("molecule")) &&
              firstRowFirstCell.length < 50 ) {
            startIndex = 1;
          }
          smilesFromFile = rows.slice(startIndex)
            .map(row => row.split(/[,;\t]/)[0] ? row.split(/[,;\t]/)[0].trim() : "")
            .filter(s => s && s.length > 2 && !s.toLowerCase().includes("smiles") && !s.toLowerCase().includes("compound"));
        }
      } else {
        throw new Error("Could not parse file. Ensure SMILES are in the first column of a valid Excel (xlsx, xls) or CSV file.");
      }
    }
    if (smilesFromFile.length === 0 && jsonSheet && jsonSheet.length > 0) {
        // If no SMILES were extracted but file had rows, it might be a format issue or no valid SMILES
        console.warn("File parsed but no valid SMILES extracted. Check first column and header logic.");
    }
    return smilesFromFile;
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = ['.csv', '.xls', '.xlsx'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!allowedTypes.includes(fileExtension)) {
        setInputError('Invalid file type. Please upload CSV, XLS, or XLSX.');
        setSelectedFile(null); setFileName(''); event.target.value = null;
        return;
      }
      setSelectedFile(file); setFileName(file.name);
      setTextareaValue(''); setInputError(''); setResults(null);
    } else {
      setSelectedFile(null); setFileName('');
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true); setResults(null); setInputError('');
    let smilesToProcess = [];

    if (selectedFile) {
      try {
        const fileData = await readFileContent(selectedFile);
        smilesToProcess = parseFileContent(fileData.content, fileData.isBinary, selectedFile.name);
        if (smilesToProcess.length === 0) {
          setInputError("No valid SMILES found in file. Check format (SMILES in first column, optional header).");
          setIsLoading(false); return;
        }
      } catch (error) {
        setInputError(error.message || "Failed to process file.");
        setIsLoading(false); return;
      }
    } else if (textareaValue.trim() !== "") {
      smilesToProcess = textareaValue.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
    }

    if (smilesToProcess.length === 0) {
      setInputError("No SMILES input. Enter in textarea or upload file.");
      setIsLoading(false); return;
    }
    if (smilesToProcess.length > MAX_COMPOUNDS) {
      setInputError(`Max ${MAX_COMPOUNDS} compounds allowed. You provided ${smilesToProcess.length}.`);
      setIsLoading(false); return;
    }

    try {
      const payload = { compound: smilesToProcess, percentage: Number(percentage) };
      const res = await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) setResults({ error: data.error || `Server Error: ${res.status}` });
      else setResults(data);
    } catch (err) {
      setResults({ error: `Network/Parsing Error: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };
  
  const clearInputs = () => {
    setTextareaValue(''); setSelectedFile(null); setFileName('');
    setInputError(''); setResults(null);
    const fileInput = document.getElementById('fileUpload');
    if (fileInput) fileInput.value = null;
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200`}>
      {/* Particles Background */}
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-cyan-500/20 dark:bg-cyan-400/10"
            style={{ width: p.size, height: p.size, left: `${p.x}%`, top: `${p.y}%` }}
            initial={{ opacity: 0, y: p.y + 20 }}
            animate={{ opacity: 1, y: p.y - 20 }}
            exit={{ opacity: 0 }}
            transition={{ delay: p.delay, duration: p.duration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
          />
        ))}
      </AnimatePresence>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <header className="flex justify-between items-center mb-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-3xl sm:text-4xl font-bold text-cyan-600 dark:text-cyan-400">
              PKM2 Target Predictor
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Batch classify compounds and predict AC50 for PKM2 activators.
            </p>
          </motion.div>
          <motion.button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle theme"
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
          >
            {theme === 'light' ? <IconMoon /> : <IconSun />}
          </motion.button>
        </header>

        {/* Input Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white dark:bg-gray-800/70 backdrop-blur-md shadow-xl rounded-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700"
        >
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="smilesInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Enter SMILES Strings
              </label>
              <textarea
                id="smilesInput" rows={6}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-cyan-500 focus:border-cyan-500 bg-gray-50 dark:bg-gray-700 text-sm font-mono placeholder-gray-400 dark:placeholder-gray-500"
                placeholder={`CCC,CCO\nCNC(=O)C1=CN=CN1\nMax ${MAX_COMPOUNDS} compounds, separated by comma or newline.`}
                value={textareaValue}
                onChange={(e) => { setTextareaValue(e.target.value); setSelectedFile(null); setFileName(''); setInputError(''); setResults(null);}}
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="fileUpload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Or Upload File
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md hover:border-cyan-500 dark:hover:border-cyan-400 transition-colors">
                <div className="space-y-1 text-center">
                  
                  <div className="flex text-sm text-gray-600 dark:text-gray-400">
                  <IconUpload />
                    <label htmlFor="fileUpload" className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 dark:focus-within:ring-offset-gray-800 focus-within:ring-cyan-500 px-1">
                      <span>Upload a file</span>
                      <input id="fileUpload" name="fileUpload" type="file" className="sr-only" 
                             accept=".csv, .xlsx, .xls" onChange={handleFileChange} disabled={isLoading} />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500">CSV, XLSX, XLS up to 1MB. SMILES in first column.</p>
                  {fileName && <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">Selected: {fileName}</p>}
                </div>
              </div>
            </div>
          </div>

          {inputError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md text-red-700 dark:text-red-300 text-sm">
              {inputError}
            </motion.div>
          )}

          <div className="mb-6">
            <label htmlFor="percentageSlider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Regression Confidence Interval ({percentage}%)
            </label>
            <input id="percentageSlider" type="range" min="1" max="99" step="1" value={percentage}
              onChange={(e) => setPercentage(e.target.value)} disabled={isLoading}
              className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-500 dark:accent-cyan-400 focus:outline-none"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <motion.button
              onClick={handleSubmit}
              disabled={isLoading || (!textareaValue.trim() && !selectedFile)}
              className={`w-full sm:w-auto flex-grow py-3 px-6 rounded-md font-semibold text-base transition-all duration-300 ease-in-out
                          text-white disabled:opacity-50 disabled:cursor-not-allowed
                          ${isLoading 
                            ? 'bg-cyan-500 dark:bg-cyan-600 animate-pulse' 
                            : 'bg-cyan-600 dark:bg-cyan-500 hover:bg-cyan-700 dark:hover:bg-cyan-400'
                          }
                          focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-cyan-500`}
              whileHover={{ scale: isLoading ? 1 : 1.03 }}
              whileTap={{ scale: isLoading ? 1 : 0.97 }}
              animate={isLoading ? {
                boxShadow: ["0 0 0px 0px rgba(6,182,212,0.0)", "0 0 8px 2px rgba(6,182,212,0.7)", "0 0 0px 0px rgba(6,182,212,0.0)"],
              } : {}}
              transition={isLoading ? { duration: 1.5, repeat: Infinity, ease:"linear" } : { duration: 0.15}}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin mr-2" />
                  Analyzing...
                </div>
              ) : 'Predict Properties'}
            </motion.button>
            <button onClick={clearInputs} disabled={isLoading}
              className="w-full sm:w-auto py-3 px-6 rounded-md font-semibold text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50">
              Clear All
            </button>
          </div>
        </motion.div>

        {/* Results Display Section */}
        <AnimatePresence>
        {isLoading && !results && (
             <motion.div 
                key="loadingResults"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-8 text-center text-gray-500 dark:text-gray-400">
                Fetching results, please wait...
             </motion.div>
        )}
        {results && (
          <motion.div 
            key="resultsContent"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-10 bg-white dark:bg-gray-800/70 backdrop-blur-md shadow-xl rounded-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700"
          >
            {results.error && (
                <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md text-red-700 dark:text-red-300">
                    <h3 className="text-lg font-semibold mb-1">API Error</h3>
                    <p className="text-sm">{results.error}</p>
                </div>
            )}

            {tableData.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Prediction Summary Table</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">#</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Molecule (SMILES)</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Predicted Type</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Predicted AC50 (Activators)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {tableData.map((item, index) => (
                        <tr key={item.smiles + index} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">{index + 1}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-gray-700 dark:text-gray-300 break-all max-w-xs truncate" title={item.smiles}>{item.smiles}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                              ${ item.type === "Activator" ? "bg-green-100 dark:bg-green-700/30 text-green-800 dark:text-green-300" :
                                 item.type === "Inhibitor" ? "bg-amber-100 dark:bg-amber-700/30 text-amber-800 dark:text-amber-300" :
                                 item.type === "Decoy" ? "bg-blue-100 dark:bg-blue-700/30 text-blue-800 dark:text-blue-300" :
                                 "bg-red-100 dark:bg-red-700/30 text-red-800 dark:text-red-300"}`}>
                              {item.type}
                            </span>
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-xs ${item.type === 'Activator' && !item.AC50.toLowerCase().includes("error") ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                            {item.AC50}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {chartData.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Results Distribution</h3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label fill="#8884d8">
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[entry.name] || '#82ca9d'} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value, name) => [`${value} compound(s)`, name]}/>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {results.batch_processing_errors && results.batch_processing_errors.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">SMILES Processing Errors:</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md border border-gray-200 dark:border-gray-600">
                {results.batch_processing_errors.map((err, index) => (
                  <div key={`batch-err-${index}`} className="text-xs text-red-700 dark:text-red-300">
                    <p className="break-all"><strong>Input:</strong> "{err.smiles || err.input_smiles || "(unknown)"}" - <strong>Error:</strong> {err.error}</p>
                  </div>
                ))}
                </div>
              </div>
            )}
            {tableData.length === 0 && chartData.length === 0 && !results.error && (
                 <p className="text-center text-gray-500 dark:text-gray-400">No results to display. Submit SMILES for analysis.</p>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}