"use client"
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function Home() {
  const [compound, setCompound] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [particles, setParticles] = useState([]);

  // Generate floating particles for background
  useEffect(() => {
    const newParticles = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 5
    }));
    setParticles(newParticles);
  }, []);

  const handleSubmit = async () => {
    setIsLoading(true);
    setResult('');
    
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compound }),
      });

      const data = await res.json();
      
      if (data.prediction !== undefined) {
        setResult(`Prediction: ${data.prediction}`);
      } else {
        setResult(`Error: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      setResult('Connection error - ensure server is running');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gray-900 overflow-hidden">
      {/* Floating particles background */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-blue-400 opacity-20"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
          }}
          animate={{
            y: [0, -20, 0],
            x: [0, 5, 0],
          }}
          transition={{
            duration: 5 + particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Glowing grid overlay */}
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
            PKM2 Multi-Class Classifier
          </h1>
          <p className="text-xl text-gray-300">
              Classify compounds as Activators, Inhibitors or Decoys for the PKM2 Protein
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="bg-gray-800 bg-opacity-50 backdrop-blur-lg rounded-xl p-8 border border-gray-700 shadow-2xl"
        >
          <div className="mb-6">
            <label className="block text-lg font-medium text-cyan-300 mb-2">
              Enter SMILES Notation
            </label>
            <textarea
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-200 font-mono focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all h-32"
              placeholder="Example: C1=CC=CC=C1 (Benzene)"
              value={compound}
              onChange={(e) => setCompound(e.target.value)}
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={isLoading}
            className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-all ${isLoading ? 'bg-blue-800 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:shadow-lg hover:shadow-cyan-500/20'}`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Analyzing Molecule...</span>
              </div>
            ) : (
              'Predict Molecular Properties'
            )}
          </motion.button>
        </motion.div>

        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-8 bg-gray-800 bg-opacity-50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 overflow-hidden"
          >
            <h3 className="text-xl font-semibold text-cyan-300 mb-2">Analysis Results</h3>
            <div className="p-4 bg-gray-900 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0 h-5 w-5 text-cyan-400 mt-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-lg font-mono text-gray-200">{result}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </div>      
    </div>
  );
}