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
        primary: "bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow-lg shadow-indigo-500/20 border-transparent",
        secondary: "bg-white/10 hover:bg-white/20 text-white border border-white/10",
        danger: "bg-red-500/80 hover:bg-red-500 text-white",
        ghost: "hover:bg-white/5 text-white/70 hover:text-white",
        white: "bg-white text-slate-900 hover:bg-gray-100 border-transparent"
    };
    return (
        <button onClick={onClick} className={`px-6 py-3 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2 border disabled:opacity-50 disabled:cursor-not-allowed text-sm ${variants[variant]} ${className}`} {...props}>
            {children}
        </button>
    );
};

const Input = ({ label, ...props }) => (
    <div className="mb-4 w-full">
        {label && <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider">{label}</label>}
        <input className="w-full px-4 py-3 bg-[#23263a] border border-white/5 rounded-xl focus:ring-2 focus:ring-[#6366f1] focus:border-transparent outline-none transition-all placeholder:text-gray-600 text-white text-sm" {...props} />
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
    doc.setFontSize(18); doc.text("Stock Movement Report", 14, 20);
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(profile.name, 14, 34);
    const tableColumn = ["Date", "Type", "Item", "Qty", "Reason"];
    const tableRows = logs.map(log => [new Date(log.date).toLocaleDateString(), log.type, log.prodName, log.qty, log.reason]);
    doc.autoTable({ head: [tableColumn], body: tableRows, startY: 40 });
    doc.save("Stock_Report.pdf");
};

// --- APP ---
function App() {
    // STATE
    const [view, setView] = useState('login'); 
    const [user, setUser] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    
    // UI State
    const [showMobileCart, setShowMobileCart] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    
    // DATA STORE
    const [data, setData] = useState(() => {
        const saved = localStorage.getItem('pos_data_v18'); 
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
    useEffect(() => localStorage.setItem('pos_data_v18', JSON.stringify(data)), [data]);
    useEffect(() => {
        localStorage.setItem('gh_config', JSON.stringify(ghConfig));
        if (ghConfig.token && ghConfig.gistId) setIsOnline(true);
    }, [ghConfig]);

    // ACTIONS
    const updateData = (key, val) => setData(prev => ({ ...prev, [key]: val }));
    
    // --- CART LOGIC (ADD/REMOVE) ---
    const updateCartQty = (itemId, delta) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.id === itemId) {
                    return { ...item, quantity: Math.max(0, item.quantity + delta) };
                }
                return item;
            }).filter(item => item.quantity > 0);
        });
    };

    const adjustStock = (productId, delta, reason) => {
        const product = data.products.find(p => p.id === productId);
        if(!product) return;
        if (product.stock + delta < 0) return;
        const newProducts = data.products.map(p => p.id === productId ? { ...p, stock: p.stock + delta } : p);
        const logEntry = { id: Date.now(), date: new Date().toISOString(), type: delta > 0 ? 'IN' : 'OUT', prodName: product.name, qty: Math.abs(delta), reason: reason || 'Manual Adjustment' };
        setData(prev => ({ ...prev, products: newProducts, stockLog: [logEntry, ...prev.stockLog] }));
    };

    const deleteItem = (id) => {
        if(confirm("Are you sure you want to delete this item?")) {
            const newProducts = data.products.filter(p => p.id !== id);
            setData(prev => ({ ...prev, products: newProducts }));
        }
    };

    const saveEditedItem = () => {
        if(!editingItem) return;
        const newProducts = data.products.map(p => p.id === editingItem.id ? editingItem : p);
        setData(prev => ({ ...prev, products: newProducts }));
        setEditingItem(null);
    };

    const checkout = () => {
        if(cart.length === 0) return;
        const total = cart.reduce((a,b) => a + (b.price * b.quantity), 0);
        const tx = { id: Date.now().toString(36).toUpperCase(), date: new Date().toISOString(), items: [...cart], total, cashier: user.name };
        const newProducts = data.products.map(p => {
            const inCart = cart.find(c => c.id === p.id);
            return inCart ? { ...p, stock: p.stock - inCart.quantity } : p;
        });
        const newLogs = cart.map(i => ({ id: Date.now() + Math.random(), date: new Date().toISOString(), type: 'OUT', prodName: i.name, qty: i.quantity, reason: 'Sale' }));
        setData(prev => ({ ...prev, products: newProducts, sales: [tx, ...prev.sales], stockLog: [...newLogs, ...prev.stockLog] }));
        setReceiptTx(tx);
        setCart([]);
        setShowMobileCart(false);
    };

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
                 <div style="text-align: left; font-size: 12px;">${new Date(tx.date).toLocaleTimeString()}</div>
                <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
                <table style="width: 100%; font-size: 12px; text-align: left; border-collapse: collapse;">
                    <thead><tr><th style="padding: 2px 0;">Item</th><th style="padding: 2px 0; text-align:center">Qty</th><th style="padding: 2px 0; text-align:right">Price</th></tr></thead>
                    <tbody>${tx.items.map(item => `<tr><td style="padding: 2px 0;">${item.name}</td><td style="padding: 2px 0; text-align:center">${item.quantity}</td><td style="padding: 2px 0; text-align:right">${(item.price * item.quantity).toFixed(2)}</td></tr>`).join('')}</tbody>
                </table>
                <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;"><span>TOTAL</span><span>₹${tx.total.toFixed(2)}</span></div>
                <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
                <p style="font-size: 10px; margin-top: 5px;">Thank you! Visit Again.</p>
            </div>
        `;
        const printArea = document.getElementById('print-area');
        if(printArea) { printArea.innerHTML = printContent; window.print(); }
    };

    // --- CLOUD LOGIC ---
    const createCloudDatabase = async () => {
        if(!ghConfig.token) { alert("Please enter a GitHub Token first."); return; }
        setIsSyncing(true);
        try {
            const res = await fetch("https://api.github.com/gists", {
                method: "POST",
                headers: { "Authorization": `token ${ghConfig.token}`, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json" },
                body: JSON.stringify({ description: "GL POS Database", public: false, files: { "pos_data.json": { content: JSON.stringify(data) } } })
            });
            const json = await res.json();
            if(!res.ok) throw new Error(json.message || "GitHub refused the connection.");
            if(json.id) {
                setGhConfig(prev => ({ ...prev, gistId: json.id }));
                alert("Database Created Successfully! Auto-sync is now active.");
                setIsOnline(true);
            }
        } catch(e) { alert("Error: " + e.message); } finally { setIsSyncing(false); }
    };

    const syncCloud = async (silent = false) => {
        if(!ghConfig.token || !ghConfig.gistId) return;
        setIsSyncing(true);
        try {
            await fetch(`https://api.github.com/gists/${ghConfig.gistId}`, {
                method: "PATCH",
                headers: { "Authorization": `token ${ghConfig.token}`, "Accept": "application/vnd.github.v3+json" },
                body: JSON.stringify({ files: { "pos_data.json": { content: JSON.stringify(data) } } })
            });
            setIsOnline(true);
            if(!silent) alert("Synced to Cloud!");
        } catch(e) { setIsOnline(false); if(!silent) alert("Sync Failed"); } finally { setIsSyncing(false); }
    };

    useEffect(() => {
        if(!ghConfig.token || !ghConfig.gistId) return;
        const timer = setTimeout(() => { syncCloud(true); }, 5000);
        return () => clearTimeout(timer);
    }, [data, ghConfig]);

    // --- NAVIGATION FILTER ---
    const getNavItems = () => {
        const allNav = [
            { id: 'pos', icon: 'shopping_cart', label: 'POS', roles: ['Admin', 'Staff'] },
            { id: 'inventory', icon: 'inventory_2', label: 'Inventory', roles: ['Admin'] },
            { id: 'reports', icon: 'analytics', label: 'Reports', roles: ['Admin'] },
            { id: 'users', icon: 'group', label: 'Users', roles: ['Admin'] },
            { id: 'settings', icon: 'settings', label: 'Settings', roles: ['Admin'] }
        ];
        return allNav.filter(item => item.roles.includes(user?.role || 'Staff'));
    };

    // --- VIEWS ---
    const LoginView = () => (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background-dark">
            <div className="glass-panel w-full max-w-sm p-8 rounded-3xl relative z-10 animate-in">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#6366f1] flex items-center justify-center shadow-lg">
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
        const currentTotal = cart.reduce((a,b) => a + (b.price * b.quantity), 0);

        return (
            <div className="flex h-full animate-in overflow-hidden">
                <div className="flex-1 flex flex-col h-full relative min-w-0"> 
                    
                    {/* MOBILE TOP NAV + HEADER */}
                    <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0f111a]/95 backdrop-blur-xl border-b border-white/5 pb-2">
                        <div className="flex justify-between items-center p-4 pb-2">
                             <h1 className="font-bold text-lg flex items-center gap-2">
                                <span className="bg-[#6366f1] px-2 py-0.5 rounded text-white text-xs">GL</span> POS
                             </h1>
                             <button onClick={() => setView('login')} className="text-xs text-gray-500 hover:text-white">Logout</button>
                        </div>
                        {/* Navigation Icons Row */}
                        <div className="flex justify-around items-center px-2">
                            {getNavItems().map(item => (
                                <button 
                                    key={item.id} 
                                    onClick={() => setView(item.id)}
                                    className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all ${view === item.id ? 'text-[#6366f1]' : 'text-gray-500'}`}
                                >
                                    <Icon name={item.icon} size={24} filled={view === item.id}/>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* MOBILE SEARCH (Below Header) */}
                    <div className="md:hidden mt-[110px] p-4 pb-0">
                        <div className="relative">
                            <Icon name="search" className="absolute left-3 top-3 text-gray-500" size={20}/>
                            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items..." className="w-full bg-[#181b29] border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-[#6366f1] transition-colors text-sm text-white"/>
                        </div>
                    </div>

                    {/* DESKTOP HEADER */}
                    <div className="hidden md:flex p-4 gap-4 bg-[#0f111a]/90 backdrop-blur-md z-10 sticky top-0">
                        <div className="relative flex-1">
                            <Icon name="search" className="absolute left-3 top-3 text-gray-500" size={20}/>
                            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items..." className="w-full bg-[#181b29] border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-[#6366f1] transition-colors text-sm text-white"/>
                        </div>
                    </div>

                    {/* PRODUCT GRID */}
                    <div className="p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-48 md:pb-4 no-scrollbar">
                        {filtered.map(p => (
                            <button key={p.id} onClick={() => p.stock > 0 && setCart(prev => {
                                const ex = prev.find(i => i.id === p.id);
                                return ex ? prev.map(i => i.id === p.id ? {...i, quantity: i.quantity+1}:i) : [...prev, {...p, quantity:1}];
                            })} disabled={p.stock <= 0} className="bg-[#181b29]/60 backdrop-blur-md border border-white/5 p-4 rounded-2xl flex flex-col items-start text-left hover:bg-white/10 active:scale-95 disabled:opacity-50 transition-all relative overflow-hidden group">
                                <div className="w-10 h-10 rounded-lg bg-[#6366f1]/20 flex items-center justify-center mb-3 text-[#818cf8] group-hover:text-white transition-colors">
                                    <span className="font-bold text-lg">{p.name[0]}</span>
                                </div>
                                <div className="font-bold text-white leading-tight mb-1">{p.name}</div>
                                <div className="text-xs text-gray-400 mb-2">{p.stock} in stock</div>
                                <div className="font-mono text-[#6366f1] font-bold">₹{p.price.toFixed(2)}</div>
                                {p.stock <= 0 && <div className="absolute top-2 right-2 bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded font-bold">OUT</div>}
                            </button>
                        ))}
                    </div>
                    
                    {/* --- MOBILE FLOATING BILL BAR --- */}
                    {cart.length > 0 && (
                        <div className="md:hidden fixed bottom-6 left-4 right-4 z-50 animate-in">
                            <div className="bg-[#1e1e2d] p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10 ring-1 ring-white/5">
                                {/* Click Area to Open Cart Modal */}
                                <div className="flex items-center gap-3 active:scale-95 transition-transform" onClick={() => setShowMobileCart(true)}>
                                    <div className="w-12 h-12 bg-[#2b2b40] rounded-full flex items-center justify-center text-[#6366f1] relative">
                                        <Icon name="shopping_bag" size={24}/>
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-[#1e1e2d]">{cart.reduce((a,b)=>a+b.quantity,0)}</span>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5 flex items-center gap-1">Total <Icon name="expand_less" size={14}/></div>
                                        <div className="font-bold text-white text-xl">₹{currentTotal.toFixed(2)}</div>
                                    </div>
                                </div>
                                <Button onClick={checkout} className="bg-[#6366f1] hover:bg-[#4f46e5] px-8 py-3 h-12 text-base shadow-lg shadow-indigo-500/30 border-none">Gen Bill</Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- DESKTOP SIDEBARS (UPDATED WITH +/- BUTTONS) --- */}
                <div className="hidden md:flex w-[320px] lg:w-[380px] flex-col border-l border-white/5 bg-[#181b29] h-full shrink-0">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                        <h2 className="text-xl font-bold flex items-center gap-2"><Icon name="receipt_long"/> Current Bill</h2>
                        {cart.length > 0 && <button onClick={()=>setCart([])} className="text-xs text-red-400 hover:text-red-300">Clear</button>}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {cart.length === 0 ? (
                             <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                                <Icon name="shopping_cart_off" size={48} className="mb-2"/>
                                <p>Cart is empty</p>
                             </div>
                        ) : (
                             cart.map(item => (
                                <div key={item.id} className="bg-white/5 p-3 rounded-xl flex items-center justify-between group">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-white text-sm truncate">{item.name}</div>
                                        <div className="text-xs text-gray-400">₹{item.price}</div>
                                    </div>
                                    
                                    {/* Desktop Quantity Controls */}
                                    <div className="flex items-center gap-2 bg-[#0f111a] rounded-lg p-1 mx-2">
                                        <button onClick={() => updateCartQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"><Icon name="remove" size={14}/></button>
                                        <span className="font-mono font-bold w-4 text-center text-white text-xs">{item.quantity}</span>
                                        <button onClick={() => updateCartQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center text-white bg-[#6366f1] hover:bg-[#4f46e5] rounded transition-colors"><Icon name="add" size={14}/></button>
                                    </div>

                                    <div className="font-bold text-white text-sm w-16 text-right">₹{(item.price * item.quantity).toFixed(2)}</div>
                                </div>
                             ))
                        )}
                    </div>
                    <div className="p-6 bg-black/20 border-t border-white/5">
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm text-gray-400">
                                <span>Items</span>
                                <span>{cart.reduce((a,b)=>a+b.quantity,0)}</span>
                            </div>
                            <div className="flex justify-between text-xl font-bold text-white">
                                <span>Total</span>
                                <span>₹{currentTotal.toFixed(2)}</span>
                            </div>
                        </div>
                        <Button onClick={checkout} className="w-full py-4 text-base" disabled={cart.length===0}>Generate Bill & Print</Button>
                    </div>
                </div>
            </div>
        );
    };

    const InventoryView = () => (
        <div className="animate-in pt-[130px] md:pt-0 p-4 lg:p-8 overflow-y-auto h-full">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Inventory</h2>
                <Button onClick={() => {
                    const n = prompt("Item Name");
                    const p = Number(prompt("Price (₹)"));
                    const s = Number(prompt("Initial Stock"));
                    if(n && p && s) {
                        const newId = Date.now();
                        updateData('products', [...data.products, { id: newId, name: n, price: p, category: 'General', stock: s }]);
                        setData(prev => ({ ...prev, stockLog: [{ id: Date.now(), date: new Date().toISOString(), type: 'IN', prodName: n, qty: s, reason: 'New Item' }, ...prev.stockLog] }));
                    }
                }} size="sm"><Icon name="add"/> Add Item</Button>
            </div>
            <div className="grid gap-3">
                {data.products.map(p => (
                    <div key={p.id} className="bg-white/5 p-3 rounded-xl flex items-center justify-between border border-white/5">
                        <div className="flex-1">
                            <div className="font-bold text-white">{p.name}</div>
                            <div className="text-xs text-gray-400">₹{p.price}</div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={() => setEditingItem(p)} className="text-blue-400 hover:text-white"><Icon name="edit" size={20}/></button>
                            <button onClick={() => deleteItem(p.id)} className="text-red-400 hover:text-red-200"><Icon name="delete" size={20}/></button>
                            <div className="flex items-center gap-3 bg-[#181b29] px-2 py-1 rounded-lg border border-white/5">
                                <button onClick={() => adjustStock(p.id, -1, 'Manual Correction')} className="text-gray-400 hover:text-white"><Icon name="remove" size={18}/></button>
                                <span className="w-6 text-center font-mono text-sm">{p.stock}</span>
                                <button onClick={() => adjustStock(p.id, 1, 'Stock Restock')} className="text-[#6366f1] hover:text-white"><Icon name="add" size={18}/></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const ReportsView = () => {
        const [reportType, setReportType] = useState('sales'); 
        return (
            <div className="animate-in pt-[130px] md:pt-0 flex flex-col gap-6 p-4 lg:p-8 overflow-y-auto h-full">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Analytics</h2>
                    <div className="flex gap-2 bg-[#181b29] p-1 rounded-lg">
                        <button onClick={()=>setReportType('sales')} className={`px-3 py-1 text-xs rounded-md transition-colors ${reportType==='sales' ? 'bg-[#6366f1] text-white' : 'text-gray-400'}`}>Sales</button>
                        <button onClick={()=>setReportType('stock')} className={`px-3 py-1 text-xs rounded-md transition-colors ${reportType==='stock' ? 'bg-[#6366f1] text-white' : 'text-gray-400'}`}>Stock</button>
                    </div>
                </div>
                {reportType === 'sales' ? (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-5 rounded-2xl relative overflow-hidden col-span-2 bg-gradient-to-br from-white/5 to-transparent">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><Icon name="trending_up" size={64}/></div>
                            <div className="text-xs text-gray-400 uppercase tracking-wider font-bold">Total Revenue</div>
                            <div className="text-3xl font-bold mt-1 text-white">₹{data.sales.reduce((a,b)=>a+b.total,0).toFixed(2)}</div>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl col-span-2">
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
                    <div className="bg-white/5 p-4 rounded-2xl h-[500px] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold">Stock Movement</h3>
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
             <div className="animate-in pt-[130px] md:pt-0 p-4 lg:p-8 overflow-y-auto h-full">
                 <h2 className="text-
