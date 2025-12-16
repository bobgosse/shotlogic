// src/pages/Dashboard.tsx - COMPLETE CONTENT with Cloud Fetch Logic

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, List, FileText, ArrowRight, Loader2, Save } from 'lucide-react';

// Define the Project type expected from the backend
interface ProjectSummary {
    id: string;
    name: string;
    updatedAt: string;
}

// Utility to format the date
const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch the list of projects from the cloud
  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
        const response = await fetch('/api/projects/get-all');
        const result = await response.json();

        if (!response.ok || !result.projects) {
            throw new Error(result.error || 'Failed to retrieve project list from cloud.');
        }
        
        setProjects(result.projects);
    } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError("Failed to connect to cloud database or fetch projects.");
        // Fallback to placeholder data if connection fails
        setProjects([
            { id: 'local_1', name: "Local Fallback: The Last Gambit", updatedAt: new Date().toISOString() },
            { id: 'local_2', name: "Local Fallback: New Pilot", updatedAt: new Date(Date.now() - 86400000).toISOString() },
        ]);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);


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
                    
                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex justify-center items-center p-8 text-blue-600">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" />
                            Fetching projects from the cloud...
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="p-4 bg-red-100 text-red-700 border-l-4 border-red-500">
                            <strong>Connection Error:</strong> {error} Showing limited local placeholders. Please check your MongoDB URI.
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoading && projects.length === 0 && !error && (
                        <div className="text-center p-8 text-gray-500">
                            You have no saved projects in the cloud yet. Start a new analysis and click 'Save'!
                        </div>
                    )}

                    {/* Project Table */}
                    {!isLoading && projects.length > 0 && (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                                    <th className="px-6 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {projects.map((project) => (
                                    <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            <Save className="w-4 h-4 mr-2 inline-block text-green-500" />
                                            {project.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(project.updatedAt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {/* We will update this link to fetch the project data later */}
                                            <Link 
                                                to={`/analyze?projectId=${project.id}`} 
                                                className="text-blue-600 hover:text-blue-800 flex items-center justify-end gap-1"
                                            >
                                                Load Analysis <ArrowRight className="w-4 h-4" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

        </main>
    </div>
  );
}