"use client"
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx'; // For parsing Excel files
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip,
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Scatter
} from 'recharts';

// --- Configuration ---
const MAX_COMPOUNDS = 20;
const API_URL = 'https://honest-tuna-striking.ngrok-free.app/api/predict'; // Ensure this matches your backend

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

const ACTIVATOR_CHART_COLORS = {
  bar: '#88BFE8', // Custom light blue for range bars
  medianDot: '#FF6347' // Tomato red for median dot
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
  const [chartData, setChartData] = useState([]); // For Pie chart
  const [activatorAC50Data, setActivatorAC50Data] = useState([]); // For Activator AC50 range chart
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 30 }).map((_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: Math.random() * 2.5 + 0.5,
      delay: Math.random() * 7 + 3,
      duration: Math.random() * 10 + 10
    }));
    setParticles(newParticles);
  }, []);

  useEffect(() => {
    const savedTheme = typeof window !== "undefined" ? localStorage.getItem('theme') || 'dark' : 'dark';
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
    if (typeof window !== "undefined") {
      localStorage.setItem('theme', newTheme);
    }
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    if (results && results.classification_results) {
      const newTableData = Object.entries(results.classification_results).map(([smiles, classification]) => {
        let AC50Display = 'N/A';
        let rawPurityData = {};

        if (classification === 'Activator' && results.regression_results && results.regression_results[smiles]) {
          const regData = results.regression_results[smiles];
          if (regData.error) {
            AC50Display = regData.error;
          } else {
            const medianVal = regData.regression_AC50_median.toFixed(2);
            const lowerBound = regData.regression_AC50_lower_bound.toFixed(2);
            const upperBound = regData.regression_AC50_upper_bound.toFixed(2);
            AC50Display = `Median: ${medianVal}; Range: [ ${lowerBound} - ${upperBound} ]`;

            rawPurityData = {
              median: regData.regression_AC50_median,
              lower: regData.regression_AC50_lower_bound,
              upper: regData.regression_AC50_upper_bound,
            };
          }
        }
        return {
          smiles: smiles.startsWith("EMPTY_INPUT_") ? "(Empty Input)" : smiles,
          type: classification,
          AC50: AC50Display,
          _rawPurityData: rawPurityData
        };
      });

      newTableData.sort((a, b) => {
        const orderA = TYPE_ORDER[a.type] || 999;
        const orderB = TYPE_ORDER[b.type] || 999;
        return orderA - orderB;
      });
      setTableData(newTableData);

      const counts = { Activator: 0, Inhibitor: 0, Decoy: 0, Error: 0 };
      Object.values(results.classification_results).forEach(classificationValue => {
        const typeKey = String(classificationValue);
        if (CHART_COLORS[typeKey]) {
          counts[typeKey]++;
        } else if (typeKey.toLowerCase().includes("error")) {
          counts.Error++;
        } else {
          counts.Decoy = (counts.Decoy || 0) + 1;
        }
      });

      const newChartData = Object.entries(counts)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));
      setChartData(newChartData);

      const activatorSpecificData = newTableData
        .filter(item =>
          item.type === 'Activator' &&
          item._rawPurityData &&
          typeof item._rawPurityData.median === 'number' &&
          typeof item._rawPurityData.lower === 'number' &&
          typeof item._rawPurityData.upper === 'number'
        )
        .map((item, index) => ({
          name: `${index + 1}`,
          fullSmiles: item.smiles,
          range: [
            parseFloat(item._rawPurityData.lower.toFixed(2)),
            parseFloat(item._rawPurityData.upper.toFixed(2))
          ],
          median: parseFloat(item._rawPurityData.median.toFixed(2)),
        }));
      setActivatorAC50Data(activatorSpecificData);

    } else {
      setTableData([]);
      setChartData([]);
      setActivatorAC50Data([]);
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
    let localJsonSheet = [];
    try {
      const workbook = XLSX.read(fileContent, { type: isBinary ? 'binary' : 'string', cellNF: false, cellDates: false });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("No sheets found in the file.");
      const worksheet = workbook.Sheets[sheetName];
      localJsonSheet = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, blankrows: false });

      if (localJsonSheet.length > 0) {
        let startIndex = 0;
        const firstRowFirstCell = String(localJsonSheet[0][0] || "").trim().toLowerCase();
        if (localJsonSheet.length > 1 &&
          (firstRowFirstCell.includes("smiles") || firstRowFirstCell.includes("compound") || firstRowFirstCell.includes("molecule")) &&
          firstRowFirstCell.length < 50) {
          startIndex = 1;
        }

        smilesFromFile = localJsonSheet.slice(startIndex)
          .map(row => (row && row[0]) ? String(row[0]).trim() : "")
          .filter(s => s && s.length > 2 && !s.toLowerCase().includes("smiles") && !s.toLowerCase().includes("compound"));
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
            firstRowFirstCell.length < 50) {
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
    if (smilesFromFile.length === 0 && localJsonSheet && localJsonSheet.length > 0) {
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

  const escapeCSVField = (field) => {
    if (field === null || typeof field === 'undefined') return '';
    let stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
      stringField = stringField.replace(/"/g, '""');
      return `"${stringField}"`;
    }
    return stringField;
  };

  const handleExportCSV = () => {
    if (!tableData.length) return;

    const headers = ["Compound (SMILES)", "Modulator Type", "AC50 Range"];
    const csvRows = [
      headers.join(','),
      ...tableData.map(item => [
        escapeCSVField(item.smiles),
        escapeCSVField(item.type),
        escapeCSVField(item.AC50)
      ].join(','))
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'marc_results.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };


  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200`}>
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-cyan-500/20 dark:bg-cyan-400/10 pointer-events-none"
            style={{ width: p.size, height: p.size, left: `${p.x}%`, top: `${p.y}%` }}
            initial={{ opacity: 0, y: p.y + 20 }}
            animate={{ opacity: 1, y: p.y - 20 }}
            exit={{ opacity: 0 }}
            transition={{ delay: p.delay, duration: p.duration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
          />
        ))}
      </AnimatePresence>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="flex justify-between items-center mb-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-3xl sm:text-4xl font-bold text-cyan-600 dark:text-cyan-400">
              Modulator Activator Range Classifier - AC50
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              MARC50 can batch classify modulators and predict AC50 for activators.
            </p>
          </motion.div>
          <motion.button
            onClick={toggleTheme}
            className="p-2.5 rounded-lg transition-all duration-200 border-2 border-cyan-500/40 dark:border-cyan-400/40 bg-cyan-500/10 dark:bg-cyan-400/10 hover:bg-cyan-500/20 dark:hover:bg-cyan-400/20 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 focus:ring-cyan-500 dark:focus:ring-cyan-400"
            aria-label="Toggle theme"
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
          >
            {theme === 'light' ? <IconMoon /> : <IconSun />}
          </motion.button>
        </header>

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
                onChange={(e) => { setTextareaValue(e.target.value); setSelectedFile(null); setFileName(''); setInputError(''); setResults(null); }}
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
                    <label htmlFor="fileUpload" className="relative cursor-pointer bg-white dark:bg-transparent rounded-md font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 dark:focus-within:ring-offset-gray-800 focus-within:ring-cyan-500 px-1">
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
              Confidence Interval ({percentage}%)
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
              transition={isLoading ? { duration: 1.5, repeat: Infinity, ease: "linear" } : { duration: 0.15 }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin mr-2" />
                  Analyzing...
                </div>
              ) : 'Predict'}
            </motion.button>
            <button onClick={clearInputs} disabled={isLoading}
              className="w-full sm:w-auto py-3 px-6 rounded-md font-semibold text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50">
              Clear All
            </button>
          </div>
        </motion.div>

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

              {tableData.length > 0 && !results.error && (
                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Results Summary</h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Sl. No.</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Compound (SMILES)</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Modulator Type</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">AC50 Range</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {tableData.map((item, index) => (
                          <tr key={item.smiles + index} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">{index + 1}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-gray-700 dark:text-gray-300 break-all max-w-xs truncate" title={item.smiles}>{item.smiles}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                              ${item.type === "Activator" ? "bg-green-100 dark:bg-green-700/30 text-green-800 dark:text-green-300" :
                                  item.type === "Inhibitor" ? "bg-amber-100 dark:bg-amber-700/30 text-amber-800 dark:text-amber-300" :
                                    item.type === "Decoy" ? "bg-blue-100 dark:bg-blue-700/30 text-blue-800 dark:text-blue-300" :
                                      "bg-red-100 dark:bg-red-700/30 text-red-800 dark:text-red-300"}`}>
                                {item.type}
                              </span>
                            </td>
                            <td className={`px-4 py-3 whitespace-nowrap text-xs ${item.type === 'Activator' && !item.AC50.toLowerCase().includes("error") && !item.AC50.toLowerCase().includes("n/a") ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                              {item.AC50}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(chartData.length > 0 || activatorAC50Data.length > 0) && !results.error && (
                <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  {chartData.length > 0 && (
                    <div>
                      <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Distribution</h3>
                      <div style={{ width: '100%', height: 350 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false}
                              label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }) => {
                                const RADIAN = Math.PI / 180;
                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                const textAnchor = x > cx ? 'start' : 'end';
                                return (
                                  <text x={x} y={y} fill={theme === 'dark' ? '#fff' : '#000'} textAnchor={textAnchor} dominantBaseline="central" fontSize="14px" fontWeight="bold">
                                    {`${name}: ${(percent * 100).toFixed(0)}% (${value})`}
                                  </text>
                                );
                              }}>
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[entry.name] || '#82ca9d'}
                                  stroke={theme === 'dark' ? '#1F2937' : '#FFFFFF'}
                                />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              formatter={(value, name) => [`${value} compound(s)`, name]}
                              contentStyle={theme === 'dark' ? { backgroundColor: '#374151', borderColor: '#4B5563' } : { backgroundColor: '#ffffff', borderColor: '#D1D5DB' }}
                              itemStyle={theme === 'dark' ? { color: '#D1D5DB' } : { color: '#000000' }}
                              cursor={{ fill: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {activatorAC50Data.length > 0 && (
                    <div>
                      <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Predicted AC50 Ranges</h3>
                      <div style={{ width: '100%', height: Math.max(350, activatorAC50Data.length * 35 + 70) }}>
                        <ResponsiveContainer>
                          <ComposedChart
                            layout="vertical"
                            data={activatorAC50Data}
                            margin={{ top: 5, right: 30, left: 10, bottom: 20 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke={theme === 'dark' ? "#4B5563" : "#E5E7EB"} />
                            <XAxis type="number" domain={['auto', 'auto']} allowDataOverflow
                              tick={{ fontSize: 10, fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}
                              stroke={theme === 'dark' ? '#4B5563' : '#D1D5DB'}
                            />
                            <YAxis dataKey="name" type="category" width={50} interval={0}
                              tick={{ fontSize: 10, fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}
                              stroke={theme === 'dark' ? '#4B5563' : '#D1D5DB'}
                            />
                            <RechartsTooltip
                              formatter={(value, name, entry) => {
                                if (name === "AC50 Range") {
                                  return [`${value[0]} - ${value[1]}`, name];
                                }
                                if (name === "Median AC50") {
                                  return [value, name];
                                }
                                return [value, name];
                              }}
                              labelFormatter={(label) => `Activator #${label}`}  // Simplified to just show the compound number
                              contentStyle={theme === 'dark' ? {
                                backgroundColor: '#374151',
                                borderColor: '#4B5563',
                                borderRadius: '0.5rem'
                              } : {
                                backgroundColor: '#ffffff',
                                borderColor: '#D1D5DB',
                                borderRadius: '0.5rem'
                              }}
                              itemStyle={theme === 'dark' ? { color: '#D1D5DB' } : { color: '#1F2937' }}
                              labelStyle={theme === 'dark' ? {
                                color: '#E5E7EB',
                                marginBottom: '4px',
                                fontWeight: 'bold',
                                fontSize: '11px'
                              } : {
                                color: '#374151',
                                marginBottom: '4px',
                                fontWeight: 'bold',
                                fontSize: '11px'
                              }}
                              cursor={{ fill: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                              iconSize={10}
                              payload={[
                                { value: 'AC50 Range', type: 'square', id: 'ID01', color: ACTIVATOR_CHART_COLORS.bar },
                                { value: 'Median AC50', type: 'circle', id: 'ID02', color: ACTIVATOR_CHART_COLORS.medianDot }
                              ]}
                            />
                            <Bar dataKey="range" name="AC50 Range" fill={ACTIVATOR_CHART_COLORS.bar} barSize={25} radius={[3, 3, 3, 3]} />
                            <Scatter dataKey="median" name="Median AC50" fill={ACTIVATOR_CHART_COLORS.medianDot} shape={<circle r={4} />} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {results.batch_processing_errors && results.batch_processing_errors.length > 0 && !results.error && (
                <div className="mt-6">
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

              {tableData.length === 0 && chartData.length === 0 && activatorAC50Data.length === 0 && !results.error && !isLoading && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">No results to display. Submit SMILES for analysis.</p>
              )}

              {tableData.length > 0 && !results.error && (
                <div className="mt-8 text-center sm:text-right">
                  <button
                    onClick={handleExportCSV}
                    disabled={isLoading}
                    className="py-2 px-5 rounded-md font-semibold text-sm bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500"
                  >
                    Export Results as CSV
                  </button>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}