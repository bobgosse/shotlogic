// src/pages/Dashboard.tsx - COMPLETE CONTENT

import React from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, List, FileText, ArrowRight } from 'lucide-react';

export default function Dashboard() {

  // Placeholder for projects loaded from local storage or backend
  const projects = [
      { id: 1, name: "The Last Gambit (Saved)", date: "Dec 15, 2025", scenes: 18, status: "Complete" },
      { id: 2, name: "New Pilot: Shadow Run", date: "Dec 10, 2025", scenes: 5, status: "Draft" },
  ];

  return (
    <div className="container mx-auto p-4 md:p-8">
        <header className="mb-12 border-b pb-4">
            <h1 className="text-4xl font-extrabold text-gray-900 flex items-center gap-3">
                <List className="w-8 h-8 text-blue-600" />
                Project Dashboard
            </h1>
            <p className="text-lg text-gray-600">Manage your saved analyses and start new breakdowns.</p>
        </header>

        <main className="space-y-10">

            {/* --- Start New Project Section --- */}
            <div className="p-8 bg-blue-50 border-2 border-blue-200 rounded-xl shadow-lg flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-blue-800 mb-2">Start a New Screenplay Analysis</h2>
                    <p className="text-blue-600">Upload a new file to begin the breakdown process.</p>
                </div>
                <Link 
                    to="/analyze" 
                    className="flex items-center gap-2 px-6 py-3 text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-bold hover:from-blue-700 hover:to-purple-700 transition-colors shadow-md"
                >
                    <PlusCircle className="w-5 h-5" />
                    New Analysis
                </Link>
            </div>

            {/* --- Project List Section --- */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <FileText className="w-6 h-6" />
                    Saved Projects
                </h2>
                
                <div className="bg-white rounded-lg shadow-xl border overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scenes</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Saved</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {projects.map((project) => (
                                <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {project.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {project.scenes}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span 
                                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                project.status === 'Complete' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}
                                        >
                                            {project.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {project.date}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {/* Placeholder for loading the project */}
                                        <Link to="/analyze" className="text-blue-600 hover:text-blue-900 flex items-center justify-end gap-1">
                                            Load Analysis <ArrowRight className="w-4 h-4" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </main>
    </div>
  );
}