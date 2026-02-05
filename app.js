const { useState, useEffect } = React;

// --- ICONS ---
const Icon = ({ name, size = 24, filled = false, className = "" }) => (
    <span className={`material-symbols-outlined ${className}`} 
          style={{ fontSize: size, fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}>
        {name}
    </span>
);

// --- UI COMPONENTS ---
const Button = ({ children, onClick, variant = "primary", className = "", ...props }) => {
    const variants = {
        primary: "bg-primary hover:bg-primary-hover text-white shadow-lg shadow-indigo-900/50 border-transparent",
        secondary: "bg-white/10 hover:bg-white/20 text-white border border-white/10",
        danger: "bg-red-500/80 hover:bg-red-500 text-white",
        ghost: "hover:bg-white/5 text-white/70 hover:text-white",
        white: "bg-white text-slate-900 hover:bg-gray-100 border-transparent"
    };
    return (
        <button onClick={onClick} className={`px-4 py-3 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2 border disabled:opacity-50 disabled:cursor-not-allowed text-sm ${variants[variant]} ${className}`} {...props}>
            {children}
        </button>
    );
};

const Input = ({ label, ...props }) => (
    <div className="mb-4 w-full">
        {label && <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider">{label}</label>}
        <input className="w-full px-4 py-3 bg-input-bg border border-white/5 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-600 text-white text-sm" {...props} />
    </div>
);

// --- UTILS ---
const generateReceiptPDF = (tx, profile) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ format: [80, 200], unit: 'mm' });
    
    let y = 10;
    doc.setFontSize(14); doc.setFont(undefined, 'bold');
    doc.text(profile.name || "Glass POS", 40, y, { align: 'center' });
    y += 6;
    
    doc.setFontSize(8); doc.setFont(undefined, 'normal');
    if(profile.address) { doc.text(profile.address, 40, y, { align: 'center' }); y+=4; }
    if(profile.phone) { doc.text(`Tel: ${profile.phone}`, 40, y, { align: 'center' }); y+=4; }
    
    doc.text("--------------------------------", 40, y, { align: 'center' }); y+=4;
    doc.text(`Date: ${new Date(tx.date).toLocaleDateString()} ${new Date(tx.date).toLocaleTimeString()}`, 5, y); y+=4;
    doc.text(`Bill No: ${tx.id.slice(-6)}`, 5, y); y+=6;

    doc.setFont(undefined, 'bold');
    doc.text("Item", 5, y); doc.text("Qty", 45, y); doc.text("Price", 75, y, { align: 'right' });
    y+=4; doc.setFont(undefined, 'normal');

    tx.items.forEach(item => {
        let name = item.name.substring(0, 18);
        doc.text(name, 5, y);
        doc.text(item.quantity.toString(), 48, y, { align: 'center' });
        doc.text((item.price * item.quantity).toFixed(2), 75, y, { align: 'right' });
        y+=4;
    });

    doc.text("--------------------------------", 40, y, { align: 'center' }); y+=4;
    doc.setFontSize(12); doc.setFont(undefined, 'bold');
    doc.text(`TOTAL: Rs. ${tx.total.toFixed(2)}`, 75, y, { align: 'right' });
    doc.save(`Bill_${tx.id}.pdf`);
};

const generateStockReportPDF = (logs, profile) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Stock Movement Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(profile.name, 14, 34);

    const tableColumn = ["Date", "Type", "Item", "Qty", "Reason"];
    const tableRows = [];

    logs.forEach(log => {
        const rowData = [
            new Date(log.date).toLocaleDateString(),
            log.type,
            log.prodName,
            log.qty,
            log.reason
        ];
        tableRows.push(rowData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 40,
    });

    doc.save("Stock_Report.pdf");
};

// --- APP ---
function App() {
    // STATE
    const [view, setView] = useState('login'); 
    const [user, setUser] = useState(null);
    
    // DATA STORE
    const [data, setData] = useState(() => {
        const saved = localStorage.getItem('pos_data_v3');
        return saved ? JSON.parse(saved) : {
            products: [
                { id: 1, name: "Masala Chai", price: 15.00, category: "Tea", stock: 100 },
                { id: 2, name: "Filter Coffee", price: 25.00, category: "Coffee", stock: 80 },
                { id: 3, name: "Samosa", price: 20.00, category: "Snacks", stock: 24 },
                { id: 4, name: "Vada Pav", price: 30.00, category: "Snacks", stock: 50 },
            ],
            users: [
                { id: 1, username: "admin", password: "123", role: "Admin", name: "Super Admin" },
                { id: 2, username: "staff", password: "123", role: "Staff", name: "Staff Member" }
            ],
            sales: [],
            stockLog: [],
            profile: { name: "Prasad coffee shop", address: "Raichur", phone: "9353437302", type: "Coffee Shop", location: "RAICHUR", gst: "0001111", logo: "" }
        };
    });

    const [cart, setCart] = useState([]);
    const [ghConfig, setGhConfig] = useState(() => JSON.parse(localStorage.getItem('gh_config')) || { token: '', gistId: '' });
    const [isOnline, setIsOnline] = useState(false);
    const [receiptTx, setReceiptTx] = useState(null);

    // PERSISTENCE
    useEffect(() => localStorage.setItem('pos_data_v3', JSON.stringify(data)), [data]);
    useEffect(() => {
        localStorage.setItem('gh_config', JSON.stringify(ghConfig));
        if (ghConfig.token && ghConfig.gistId) setIsOnline(true);
    }, [ghConfig]);

    // ACTIONS
    const updateData = (key, val) => setData(prev => ({ ...prev, [key]: val }));
    
    const adjustStock = (productId, delta, reason) => {
        const product = data.products.find(p => p.id === productId);
        if(!product) return;
        if (product.stock + delta < 0) return;

        const newProducts = data.products.map(p => 
            p.id === productId ? { ...p, stock: p.stock + delta } : p
        );

        const logEntry = {
            id: Date.now(),
            date: new Date().toISOString(),
            type: delta > 0 ? 'IN' : 'OUT',
            prodName: product.name,
            qty: Math.abs(delta),
            reason: reason || 'Manual Adjustment'
        };

        setData(prev => ({
            ...prev,
            products: newProducts,
            stockLog: [logEntry, ...prev.stockLog]
        }));
    };

    const checkout = () => {
        if(cart.length === 0) return;
        const total = cart.reduce((a,b) => a + (b.price * b.quantity), 0);
        const tx = {
            id: Date.now().toString(36).toUpperCase(),
            date: new Date().toISOString(),
            items: [...cart],
            total,
            cashier: user.name
        };
        
        const newProducts = data.products.map(p => {
            const inCart = cart.find(c => c.id === p.id);
            return inCart ? { ...p, stock: p.stock - inCart.quantity } : p;
        });

        const newLogs = cart.map(i => ({
            id: Date.now() + Math.random(),
            date: new Date().toISOString(),
            type: 'OUT',
            prodName: i.name,
            qty: i.quantity,
            reason: 'Sale'
        }));

        setData(prev => ({
            ...prev,
            products: newProducts,
            sales: [tx, ...prev.sales],
            stockLog: [...newLogs, ...prev.stockLog]
        }));
        
        setReceiptTx(tx);
        setCart([]);
    };

    // --- PRINT HANDLER ---
    const handlePrint = (tx) => {
        const printContent = `
            <div style="font-family: monospace; text-align: center; width: 100%; max-width: 300px; margin: 0 auto; color: black; padding: 10px;">
                <h2 style="margin: 0; font-size: 16px; font-weight: bold;">${data.profile.name}</h2>
                <p style="margin: 2px 0; font-size: 12px;">${data.profile.address}</p>
                <p style="margin: 2px 0; font-size: 12px;">Tel: ${data.profile.phone}</p>
                <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
                <div style="text-align: left; font-size: 12px; display: flex; justify-content: space-between;">
                    <span>Bill: ${tx.id.slice(-6)}</span>
                    <span>${new Date(tx.date).toLocaleDateString()}</span>
                </div>
                 <div style="text-align: left; font-size: 12px;">
                    ${new Date(tx.date).toLocaleTimeString()}
                </div>
                <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
                <table style="width: 100%; font-size: 12px; text-align: left; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="padding: 2px 0;">Item</th>
                            <th style="padding: 2px 0; text-align:center">Qty</th>
                            <th style="padding: 2px 0; text-align:right">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tx.items.map(item => `
                            <tr>
                                <td style="padding: 2px 0;">${item.name}</td>
                                <td style="padding: 2px 0; text-align:center">${item.quantity}</td>
                                <td style="padding: 2px 0; text-align:right">${(item.price * item.quantity).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
                    <span>TOTAL</span>
                    <span>₹${tx.total.toFixed(2)}</span>
                </div>
                <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
                <p style="font-size: 10px; margin-top: 5px;">Thank you! Visit Again.</p>
            </div>
        `;
        
        // Inject content into the hidden print area
        const printArea = document.getElementById('print-area');
        if(printArea) {
            printArea.innerHTML = printContent;
            window.print();
        }
    };

    const syncCloud = async () => {
        if(!ghConfig.token) return;
        try {
            await fetch(`https://api.github.com/gists/${ghConfig.gistId}`, {
                method: "PATCH",
                headers: { "Authorization": `token ${ghConfig.token}`, "Accept": "application/vnd.github.v3+json" },
                body: JSON.stringify({ files: { "pos_data.json": { content: JSON.stringify(data) } } })
            });
            alert("Synced to Cloud!");
        } catch(e) { alert("Sync Failed"); }
    };

    // --- VIEWS ---
    const LoginView = () => (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background-dark">
            <div className="glass-panel w-full max-w-sm p-8 rounded-3xl relative z-10 animate-in">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
                        <Icon name="point_of_sale" size={32} className="text-white"/>
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-center mb-2">POS Login</h1>
                <form onSubmit={e => {
                    e.preventDefault();
                    const u = data.users.find(x => x.username === e.target.u.value && x.password === e.target.p.value);
                    if(u) { setUser(u); setView('pos'); } else alert("Invalid Login");
                }}>
                    <Input name="u" placeholder="Username" />
                    <Input name="p" type="password" placeholder="Password" />
                    <Button className="w-full h-12 mt-4">Sign In</Button>
                </form>
            </div>
        </div>
    );

    const POSView = () => {
        const [search, setSearch] = useState("");
        const filtered = data.products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
        return (
            <div className="flex flex-col h-full animate-in pb-32 lg:pb-0">
                <div className="flex gap-4 mb-6 sticky top-0 bg-[#0f111a]/90 backdrop-blur-md z-10 py-2">
                    <div className="relative flex-1">
                        <Icon name="search" className="absolute left-3 top-3 text-gray-500" size={20}/>
                        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items..." className="w-full bg-surface-dark border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-primary transition-colors text-sm text-white"/>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-1">
                    {filtered.map(p => (
                        <button key={p.id} onClick={() => p.stock > 0 && setCart(prev => {
                            const ex = prev.find(i => i.id === p.id);
                            return ex ? prev.map(i => i.id === p.id ? {...i, quantity: i.quantity+1}:i) : [...prev, {...p, quantity:1}];
                        })} disabled={p.stock <= 0} className="glass-card p-4 rounded-2xl flex flex-col items-start text-left hover:bg-white/10 active:scale-95 disabled:opacity-50 transition-all relative overflow-hidden group border-white/5">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-3 text-indigo-300 group-hover:text-white transition-colors">
                                <span className="font-bold text-lg">{p.name[0]}</span>
                            </div>
                            <div className="font-bold text-white leading-tight mb-1">{p.name}</div>
                            <div className="text-xs text-gray-400 mb-2">{p.stock} in stock</div>
                            <div className="font-mono text-primary font-bold">₹{p.price.toFixed(2)}</div>
                            {p.stock <= 0 && <div className="absolute top-2 right-2 bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded font-bold">OUT</div>}
                        </button>
                    ))}
                </div>
                {cart.length > 0 && (
                    <div className="lg:hidden fixed bottom-24 left-4 right-4 z-50 animate-in">
                        <div className="glass-panel-heavy p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary relative">
                                    <Icon name="shopping_bag" size={20}/>
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{cart.reduce((a,b)=>a+b.quantity,0)}</span>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-400 font-medium">Total</div>
                                    <div className="font-bold text-white">₹{cart.reduce((a,b)=>a+(b.price*b.quantity),0).toFixed(2)}</div>
                                </div>
                            </div>
                            <Button onClick={checkout} size="sm">Gen Bill</Button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const InventoryView = () => (
        <div className="animate-in pb-24 lg:pb-0">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Inventory</h2>
                <Button onClick={() => {
                    const n = prompt("Item Name");
                    const p = Number(prompt("Price (₹)"));
                    const s = Number(prompt("Initial Stock"));
                    if(n && p && s) {
                        const newId = Date.now();
                        updateData('products', [...data.products, { id: newId, name: n, price: p, category: 'General', stock: s }]);
                        setData(prev => ({
                            ...prev, 
                            stockLog: [{ id: Date.now(), date: new Date().toISOString(), type: 'IN', prodName: n, qty: s, reason: 'New Item' }, ...prev.stockLog]
                        }));
                    }
                }} size="sm"><Icon name="add"/> Add Item</Button>
            </div>
            <div className="grid gap-3">
                {data.products.map(p => (
                    <div key={p.id} className="glass-card p-3 rounded-xl flex items-center justify-between border-white/5">
                        <div>
                            <div className="font-bold text-white">{p.name}</div>
                            <div className="text-xs text-gray-400">₹{p.price}</div>
                        </div>
                        <div className="flex items-center gap-3 bg-surface-dark px-2 py-1 rounded-lg border border-white/5">
                            <button onClick={() => adjustStock(p.id, -1, 'Manual Correction')} className="text-gray-400 hover:text-white"><Icon name="remove" size={18}/></button>
                            <span className="w-6 text-center font-mono text-sm">{p.stock}</span>
                            <button onClick={() => adjustStock(p.id, 1, 'Stock Restock')} className="text-primary hover:text-white"><Icon name="add" size={18}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const ReportsView = () => {
        const [reportType, setReportType] = useState('sales'); 

        return (
            <div className="animate-in flex flex-col gap-6 pb-24 lg:pb-0">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Analytics & Reports</h2>
                    <div className="flex gap-2 bg-surface-dark p-1 rounded-lg">
                        <button onClick={()=>setReportType('sales')} className={`px-3 py-1 text-xs rounded-md transition-colors ${reportType==='sales' ? 'bg-primary text-white' : 'text-gray-400'}`}>Sales</button>
                        <button onClick={()=>setReportType('stock')} className={`px-3 py-1 text-xs rounded-md transition-colors ${reportType==='stock' ? 'bg-primary text-white' : 'text-gray-400'}`}>Stock</button>
                    </div>
                </div>

                {reportType === 'sales' ? (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass-card p-5 rounded-2xl relative overflow-hidden col-span-2 bg-gradient-to-br from-white/5 to-transparent">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><Icon name="trending_up" size={64}/></div>
                            <div className="text-xs text-gray-400 uppercase tracking-wider font-bold">Total Revenue</div>
                            <div className="text-3xl font-bold mt-1 text-white">₹{data.sales.reduce((a,b)=>a+b.total,0).toFixed(2)}</div>
                        </div>
                        <div className="glass-card p-4 rounded-2xl col-span-2">
                             <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold">Recent Sales</h3>
                            </div>
                            <div className="text-xs space-y-2">
                                {data.sales.slice(0, 5).map(s => (
                                    <div key={s.id} className="flex justify-between p-2 bg-white/5 rounded">
                                        <span>{new Date(s.date).toLocaleTimeString()}</span>
                                        <span className="font-bold">₹{s.total}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass-card p-4 rounded-2xl h-[500px] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold">Stock Movement (IN/OUT)</h3>
                            <Button size="sm" onClick={() => generateStockReportPDF(data.stockLog, data.profile)}><Icon name="download" size={16}/> PDF</Button>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            <table className="w-full text-left text-xs text-gray-400">
                                <thead className="sticky top-0 bg-[#1e2333] z-10 font-bold text-white">
                                    <tr>
                                        <th className="p-2">Time</th>
                                        <th className="p-2">Type</th>
                                        <th className="p-2">Item</th>
                                        <th className="p-2">Qty</th>
                                        <th className="p-2">Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.stockLog.map(log => (
                                        <tr key={log.id || Math.random()} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="p-2">{new Date(log.date).toLocaleDateString()}</td>
                                            <td className={`p-2 font-bold ${log.type === 'IN' ? 'text-green-400' : 'text-red-400'}`}>{log.type}</td>
                                            <td className="p-2 text-white">{log.prodName}</td>
                                            <td className="p-2">{log.qty}</td>
                                            <td className="p-2">{log.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const UsersView = () => {
         const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'Staff' });
         return (
             <div className="animate-in h-full overflow-y-auto pb-24 lg:pb-0">
                 <h2 className="text-2xl font-bold mb-6">User Management</h2>
                 <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                     <div className="lg:col-span-3 space-y-3">
                         {data.users.map(u => (
                             <div key={u.id} className="ref-card p-4 rounded-xl flex items-center justify-between">
                                 <div className="flex items-center gap-4">
                                     <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">{u.username[0].toUpperCase()}</div>
                                     <div>
                                         <div className="font-bold text-white">{u.name}</div>
                                         <div className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-full w-fit mt-1">{u.role}</div>
                                     </div>
                                 </div>
                                 {u.username !== 'admin' && <button className="text-gray-500 hover:text-red-400" onClick={() => updateData('users', data.users.filter(x => x.id !== u.id))}><Icon name="delete"/></button>}
                             </div>
                         ))}
                     </div>
                     <div className="lg:col-span-2">
                         <div className="ref-card p-6 rounded-2xl">
                             <h3 className="font-bold mb-4">Create User</h3>
                             <div className="space-y-4">
                                 <Input label="Name" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                                 <Input label="Username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                                 <Input label="Password" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                                 <Button className="w-full" onClick={() => { if(newUser.username) updateData('users', [...data.users, { ...newUser, id: Date.now() }]); }}>Create</Button>
                             </div>
                         </div>
                     </div>
                 </div>
             </div>
         );
    };

    const SettingsView = () => (
        <div className="animate-in h-full overflow-y-auto pb-24 lg:pb-0">
            <h2 className="text-2xl font-bold mb-6">Settings</h2>
             <div className="ref-card p-6 rounded-2xl mb-6">
                <h3 className="font-bold mb-4">Business Profile</h3>
                <div className="space-y-4">
                    <Input label="Business Name" value={data.profile.name} onChange={e => updateData('profile', {...data.profile, name: e.target.value})} />
                    <Input label="Address" value={data.profile.address} onChange={e => updateData('profile', {...data.profile, address: e.target.value})} />
                    <Input label="Phone" value={data.profile.phone} onChange={e => updateData('profile', {...data.profile, phone: e.target.value})} />
                </div>
            </div>
            <div className="ref-card p-6 rounded-2xl">
                <h3 className="font-bold mb-4">Cloud Backup</h3>
                <Input label="Github Token" type="password" value={ghConfig.token} onChange={e=>setGhConfig({...ghConfig, token: e.target.value})} />
                <Input label="Gist ID" value={ghConfig.gistId} onChange={e=>setGhConfig({...ghConfig, gistId: e.target.value})} />
                <div className="flex gap-4 mt-4">
                    <Button onClick={syncCloud} variant="secondary">Sync Now</Button>
                </div>
            </div>
        </div>
    );

    if(view === 'login') return <LoginView />;

    return (
        <div className="flex h-screen w-full relative overflow-hidden bg-background-dark">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-900/20 rounded-full blur-[100px]"></div>
            </div>

            <aside className="hidden lg:flex w-64 surface-dark flex-col z-50 h-full border-r border-white/5">
                <div className="p-6"><h1 className="text-2xl font-bold">GL POS</h1></div>
                <nav className="flex-1 px-4 space-y-2 mt-4">
                    {['pos', 'inventory', 'reports', 'users', 'settings'].map(id => (
                        <button key={id} onClick={() => setView(id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl capitalize ${view === id ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}>
                            <Icon name={id === 'pos' ? 'shopping_cart' : id === 'inventory' ? 'inventory_2' : id === 'reports' ? 'analytics' : id === 'users' ? 'group' : 'settings'} size={20}/> {id}
                        </button>
                    ))}
                </nav>
            </aside>

            <main className="flex-1 flex flex-col h-full relative overflow-hidden z-0">
                <header className="lg:hidden flex justify-between items-center p-4 glass-panel sticky top-0 z-20">
                    <h1 className="font-bold text-lg capitalize">{view}</h1>
                    <button onClick={() => setView('settings')}><Icon name="settings"/></button>
                </header>

                <div className="flex-1 overflow-y-auto p-4 lg:p-8 no-scrollbar">
                    {view === 'pos' && <POSView />}
                    {view === 'inventory' && <InventoryView />}
                    {view === 'reports' && <ReportsView />}
                    {view === 'users' && <UsersView />}
                    {view === 'settings' && <SettingsView />}
                </div>

                <nav className="lg:hidden fixed bottom-6 left-6 right-6 glass-panel-heavy rounded-2xl flex justify-around items-center p-2 border border-white/10 shadow-2xl z-40">
                    <button onClick={() => setView('reports')} className={`p-3 ${view === 'reports' ? 'text-primary' : 'text-gray-500'}`}><Icon name="analytics"/></button>
                    <button onClick={() => setView('pos')} className="w-16 h-16 rounded-full bg-primary flex items-center justify-center -mt-8 border-4 border-background-dark text-white"><Icon name="point_of_sale"/></button>
                    <button onClick={() => setView('inventory')} className={`p-3 ${view === 'inventory' ? 'text-primary' : 'text-gray-500'}`}><Icon name="inventory_2"/></button>
                </nav>
            </main>

            {receiptTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                        <div className="p-4 flex justify-between items-center border-b border-white/5">
                            <h3 className="font-bold">Bill Generated</h3>
                            <button onClick={()=>setReceiptTx(null)}><Icon name="close"/></button>
                        </div>
                        <div className="p-6 bg-white text-black font-mono text-sm relative">
                            <div className="text-center mb-4">
                                <div className="font-bold text-lg">{data.profile.name}</div>
                                <div className="text-xs text-gray-500">{data.profile.address}</div>
                            </div>
                            <div className="border-b border-dashed border-gray-300 my-2"></div>
                            {receiptTx.items.map((i,idx) => (
                                <div key={idx} className="flex justify-between mb-1">
                                    <span>{i.name} x{i.quantity}</span>
                                    <span>{(i.price*i.quantity).toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="border-t border-dashed border-gray-300 my-2 pt-2 flex justify-between font-bold text-lg">
                                <span>Total</span>
                                <span>₹{receiptTx.total.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-3">
                            <Button onClick={() => handlePrint(receiptTx)} variant="secondary"><Icon name="print"/> Print</Button>
                            <Button onClick={() => generateReceiptPDF(receiptTx, data.profile)}><Icon name="download"/> PDF</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
