import React, { useState, useEffect } from 'react';

// This is the setting for live deployment. It will work on Render.
const API_BASE_URL = '/api';

// --- Main App Component ---
function App() {
  const [user, setUser] = useState(null); // Will store {matric, email, paid}
  const [view, setView] = useState('login'); // login, student, admin_receipts, admin_docs, admin_id_cards
  const [loginError, setLoginError] = useState('');
  const [matricInput, setMatricInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matric: matricInput, password: passwordInput }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      setUser(data.user);
      // Simple role-based routing
      if (data.user.matric.startsWith('admin')) {
        setView('admin_receipts'); // Default admin view
      } else {
        setView('student');
      }
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView('login');
    setMatricInput('');
    setPasswordInput('');
  };

  const renderContent = () => {
    switch (view) {
      case 'student':
        return <StudentDashboard user={user} onLogout={handleLogout} />;
      case 'admin_receipts':
        return <AdminReceiptsDashboard user={user} setView={setView} onLogout={handleLogout} />;
      case 'admin_docs':
        return <AdminDocsDashboard user={user} setView={setView} onLogout={handleLogout} />;
      case 'admin_id_cards':
        return <AdminIdCardsDashboard user={user} setView={setView} onLogout={handleLogout} />;
      case 'login':
      default:
        return (
          <LoginPage
            matric={matricInput}
            setMatric={setMatricInput}
            password={passwordInput}
            setPassword={setPasswordInput}
            handleLogin={handleLogin}
            loginError={loginError}
          />
        );
    }
  };

  return <div className="bg-gray-100 min-h-screen font-sans">{renderContent()}</div>;
}


// --- LoginPage Component ---
const LoginPage = ({ matric, setMatric, password, setPassword, handleLogin, loginError }) => (
    <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-800">FUTMINNA</h1>
                <p className="text-gray-600">Certificate Collection Portal</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Matriculation Number</label>
                    <input
                        type="text"
                        value={matric}
                        onChange={(e) => setMatric(e.target.value)}
                        required
                        className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                {loginError && <p className="text-sm text-red-600">{loginError}</p>}
                <button
                    type="submit"
                    className="w-full px-4 py-2 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    Login
                </button>
            </form>
        </div>
    </div>
);


// --- StudentDashboard Component ---
const StudentDashboard = ({ user, onLogout }) => {
    const [isCertReady, setIsCertReady] = useState(null);
    const [clearanceDocs, setClearanceDocs] = useState([]);
    const [previewFile, setPreviewFile] = useState(null); // { name, url }

    useEffect(() => {
        // Fetch certificate readiness
        fetch(`${API_BASE_URL}/status/${user.matric}`)
            .then(res => res.json())
            .then(data => setIsCertReady(data.isReady));

        // Fetch clearance documents
        fetchClearanceDocs();
    }, [user.matric]);

    const fetchClearanceDocs = () => {
        fetch(`${API_BASE_URL}/clearance/${user.matric}`)
            .then(res => res.json())
            .then(data => setClearanceDocs(data));
    };

    const handleFileUpload = async (e, docType) => {
        const file = e.target.files[0];
        if (!file) return;

        // Frontend validation
        if (file.size > 10 * 1024 * 1024) {
            alert('File is too large! Maximum size is 10MB.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/upload/${user.matric}/${docType}`, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            alert('File uploaded successfully!');
            fetchClearanceDocs(); // Refresh list
        } catch (error) {
            alert(`Upload failed: ${error.message}`);
        }
    };
    
    const handleDeleteFile = async (docType) => {
        if (!window.confirm('Are you sure you want to delete this file?')) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/delete/${user.matric}/${docType}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete file.');
            alert('File deleted successfully.');
            fetchClearanceDocs(); // Refresh
        } catch (error) {
            alert(error.message);
        }
    };
    
    const handleNotifyAdmin = async () => {
        if (!window.confirm('Are you sure you have submitted your ID card physically? This will notify the admin.')) return;
        try {
            await fetch(`${API_BASE_URL}/notify-id-card/${user.matric}`, { method: 'POST' });
            alert('Admin has been notified.');
            fetchClearanceDocs();
        } catch(error) {
            alert('Failed to notify admin.');
        }
    }

    const openPreview = (filename) => {
        setPreviewFile({ name: filename, url: `${API_BASE_URL}/view/${filename}` });
    };

    const getStatusChip = (status) => {
        const baseClasses = "px-2 py-1 text-xs font-semibold rounded-full";
        switch (status) {
            case 'verified': return <span className={`${baseClasses} bg-green-200 text-green-800`}>Verified</span>;
            case 'uploaded': return <span className={`${baseClasses} bg-yellow-200 text-yellow-800`}>Uploaded</span>;
            case 'pending': return <span className={`${baseClasses} bg-gray-200 text-gray-800`}>Pending</span>;
            case 'rejected': return <span className={`${baseClasses} bg-red-200 text-red-800`}>Rejected</span>;
            default: return <span>{status}</span>;
        }
    };
    
    const docLabels = {
        'statement_of_result': 'Statement of Result',
        'school_fees_receipt': 'School Fees Receipt (from 100L)',
        'clearance_form': 'Original Student Clearance Form',
        'certificate_payment_receipt': 'Certificate Payment Receipt',
        'id_card': '500L ID Card (Physical Submission)'
    };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
                    <p className="text-gray-600">Welcome, {user.matric}</p>
                </div>
                <button onClick={onLogout} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Logout</button>
            </header>

            {/* Status Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                 <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">Certificate Status</h2>
                    {isCertReady === null ? <p>Loading...</p> : 
                        isCertReady ? 
                        <p className="text-green-600 font-bold">Your certificate is ready for collection.</p> :
                        <p className="text-red-600 font-bold">Your certificate is not yet ready.</p>
                    }
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">Clearance Payment</h2>
                    {user.paid ? 
                        <p className="text-green-600 font-bold">Payment confirmed.</p> :
                        <>
                            <p className="text-red-600 font-bold mb-3">Payment not confirmed. Please pay to proceed.</p>
                            <a href="https://www.futminna.edu.ng" target="_blank" rel="noopener noreferrer" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                                Pay Now
                            </a>
                        </>
                    }
                </div>
            </div>

            {/* Documents Section */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Required Documents</h2>
                <ul className="space-y-4">
                    {clearanceDocs.map(doc => (
                        <li key={doc.doc_type} className="p-4 border rounded-md flex flex-col md:flex-row justify-between items-start md:items-center">
                            <div className="flex-1 mb-4 md:mb-0">
                                <p className="font-semibold">{docLabels[doc.doc_type]}</p>
                                <div className="mt-1">{getStatusChip(doc.status)}</div>
                            </div>
                            <div className="flex items-center space-x-2">
                                {doc.status === 'uploaded' || doc.status === 'verified' ? (
                                    <>
                                        <button onClick={() => openPreview(doc.filename)} className="text-sm text-blue-600 hover:underline">Preview</button>
                                        <a href={`${API_BASE_URL}/download/${doc.filename}`} className="text-sm text-blue-600 hover:underline">Download</a>
                                        {doc.status !== 'verified' && <button onClick={() => handleDeleteFile(doc.doc_type)} className="text-sm text-red-600 hover:underline">Delete</button>}
                                    </>
                                ) : doc.doc_type === 'id_card' ? (
                                    <button onClick={handleNotifyAdmin} disabled={doc.notified_admin === 'true'} className="px-3 py-1 text-sm text-white bg-green-600 rounded disabled:bg-gray-400">
                                        {doc.notified_admin === 'true' ? 'Notified' : 'Notify Admin'}
                                    </button>
                                ) : (
                                    <label className="cursor-pointer px-3 py-1 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700">
                                        Upload
                                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileUpload(e, doc.doc_type)} />
                                    </label>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            
            {/* Preview Modal */}
            {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
        </div>
    );
};


// --- Admin Navigation Component ---
const AdminNav = ({ activeView, setView }) => {
    const navItems = [
        { key: 'admin_receipts', label: 'Verify Receipts' },
        { key: 'admin_docs', label: 'Verify Documents' },
        { key: 'admin_id_cards', label: 'Confirm ID Cards' },
    ];
    return (
        <nav className="flex space-x-4 border-b mb-6">
            {navItems.map(item => (
                <button
                    key={item.key}
                    onClick={() => setView(item.key)}
                    className={`px-3 py-2 font-medium text-sm rounded-t-md ${activeView === item.key ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    {item.label}
                </button>
            ))}
        </nav>
    );
};

// --- Admin Shared Header ---
const AdminHeader = ({ user, onLogout, setView }) => (
    <header className="flex justify-between items-center mb-2">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600">Logged in as {user.matric}</p>
        </div>
        <button onClick={onLogout} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Logout</button>
    </header>
);


// --- AdminReceiptsDashboard Component ---
const AdminReceiptsDashboard = ({ user, setView, onLogout }) => {
    const [students, setStudents] = useState([]);
    
    useEffect(() => {
        fetch(`${API_BASE_URL}/admin/students`).then(res => res.json()).then(setStudents);
    }, []);

    const updateStatus = (matric, docType, newStatus) => {
         fetch(`${API_BASE_URL}/admin/update-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matric, docType, newStatus })
        }).then(() => {
            // Refresh local data for instant UI update
            setStudents(prev => prev.map(s => {
                if (s.matric === matric) {
                    const newClearance = s.clearance.map(c => c.doc_type === docType ? {...c, status: newStatus} : c);
                    return {...s, clearance: newClearance};
                }
                return s;
            }));
        });
    };

    const receiptDocs = students.map(s => ({
        ...s,
        receipt: s.clearance.find(c => c.doc_type === 'certificate_payment_receipt')
    })).filter(s => s.receipt);


    return (
         <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <AdminHeader user={user} onLogout={onLogout} setView={setView} />
            <AdminNav activeView="admin_receipts" setView={setView} />
            
            <div className="bg-white p-6 rounded-lg shadow">
                 <h2 className="text-lg font-semibold text-gray-800 mb-4">Verify Certificate Payment Receipts</h2>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matric</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {receiptDocs.map(({ matric, receipt }) => (
                          <tr key={matric}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{matric}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{receipt.status}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                {receipt.status === 'uploaded' && (
                                     <>
                                        <button onClick={() => updateStatus(matric, receipt.doc_type, 'verified')} className="text-green-600 hover:text-green-900">Verify</button>
                                        <button onClick={() => updateStatus(matric, receipt.doc_type, 'rejected')} className="text-red-600 hover:text-red-900">Reject</button>
                                        <a href={`${API_BASE_URL}/view/${receipt.filename}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">View</a>
                                     </>
                                )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- AdminDocsDashboard Component ---
const AdminDocsDashboard = ({ user, setView, onLogout }) => {
    // This would be very similar to the Receipts Dashboard, but filtering for other doc types.
    // For brevity in this example, it's a placeholder.
    return (
         <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <AdminHeader user={user} onLogout={onLogout} setView={setView} />
            <AdminNav activeView="admin_docs" setView={setView} />
             <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold text-gray-800">Verify Other Documents</h2>
                <p className="text-gray-600 mt-2">This dashboard would allow verification of the Statement of Result, School Fees Receipt, and Clearance Form. The implementation would be similar to the Receipt Verification dashboard.</p>
            </div>
        </div>
    );
};


// --- AdminIdCardsDashboard Component ---
const AdminIdCardsDashboard = ({ user, setView, onLogout }) => {
    const [students, setStudents] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetch(`${API_BASE_URL}/admin/students`).then(res => res.json()).then(setStudents);
    }, []);

     const updateStatus = (matric, docType, newStatus) => {
         fetch(`${API_BASE_URL}/admin/update-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matric, docType, newStatus })
        }).then(() => {
            setStudents(prev => prev.map(s => s.matric === matric ? { ...s, clearance: s.clearance.map(c => c.doc_type === docType ? {...c, status: newStatus} : c) } : s));
        });
    };
    
    const idCardDocs = students.map(s => ({
        matric: s.matric,
        idCard: s.clearance.find(c => c.doc_type === 'id_card')
    })).filter(s => s.idCard && s.matric.includes(searchTerm));


    return (
         <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <AdminHeader user={user} onLogout={onLogout} setView={setView} />
            <AdminNav activeView="admin_id_cards" setView={setView} />
            
            <div className="bg-white p-6 rounded-lg shadow">
                 <h2 className="text-lg font-semibold text-gray-800 mb-4">Confirm Physical ID Card Submission</h2>
                 <input
                    type="text"
                    placeholder="Search by matric number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 mb-4 border border-gray-300 rounded-md shadow-sm"
                 />
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matric</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Notified?</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {idCardDocs.map(({ matric, idCard }) => (
                          <tr key={matric}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{matric}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{idCard.notified_admin === 'true' ? 'Yes' : 'No'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{idCard.status}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                               {idCard.status !== 'verified' ? (
                                    <button onClick={() => updateStatus(matric, idCard.doc_type, 'verified')} className="text-green-600 hover:text-green-900">Mark as Submitted</button>
                               ) : (
                                    <span className="text-gray-500">Confirmed</span>
                               )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


// --- FilePreviewModal Component ---
const FilePreviewModal = ({ file, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
            <header className="flex justify-between items-center p-4 border-b">
                <h3 className="font-semibold text-lg">{file.name}</h3>
                <button onClick={onClose} className="text-2xl font-bold">&times;</button>
            </header>
            <div className="flex-1 p-2 overflow-auto">
                {file.url.endsWith('.pdf') ? (
                    <iframe src={file.url} className="w-full h-full" title="PDF Preview"></iframe>
                ) : (
                    <img src={file.url} alt="Preview" className="max-w-full max-h-full mx-auto" />
                )}
            </div>
        </div>
    </div>
);


export default App;


