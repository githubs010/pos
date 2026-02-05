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
    doc.text(`TxID: ${tx.id.slice(-6)}`, 5, y); y+=6;

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
    doc.text(`TOTAL: ${tx.total.toFixed(2)}`, 75, y, { align: 'right' });
    doc.save(`Receipt_${tx.id}.pdf`);
};

// --- APP ---
function App() {
    // STATE
    const [view, setView] = useState('login'); 
    const [user, setUser] = useState(null);
    
    // DATA STORE
    const [data, setData] = useState(() => {
        const saved = localStorage.getItem('pos_data_v2');
        return saved ? JSON.parse(saved) : {
            products: [
                { id: 1, name: "Espresso", price: 3.50, category: "Coffee", stock: 100 },
                { id: 2, name: "Latte", price: 4.50, category: "Coffee", stock: 80 },
                { id: 3, name: "Croissant", price: 3.00, category: "Bakery", stock: 24 },
                { id: 4, name: "Green Tea", price: 2.50, category: "Tea", stock: 50 },
            ],
            users: [
                { id: 1, username: "admin", password: "123", role: "Admin", name: "Super Admin" },
                { id: 2, username: "staff", password: "123", role: "Staff", name: "John Doe" }
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
    useEffect(() => localStorage.setItem('pos_data_v2', JSON.stringify(data)), [data]);
    useEffect(() => {
        localStorage.setItem('gh_config', JSON.stringify(ghConfig));
        if (ghConfig.token && ghConfig.gistId) setIsOnline(true);
    }, [ghConfig]);

    // ACTIONS
    const updateData = (key, val) => setData(prev => ({ ...prev, [key]: val }));
    
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

    // GITHUB SYNC
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
        <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-background-dark">
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse"></div>
            <div className="glass-panel w-full max-w-sm p-8 rounded-3xl relative z-10 animate-in">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center shadow-lg">
                        <Icon name="point_of_sale" size={32} className="text-white"/>
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-center mb-2">Welcome Back</h1>
                <p className="text-center text-white/50 mb-8 text-sm">Sign in to access your dashboard</p>
                <form onSubmit={e => {
                    e.preventDefault();
                    const u = data.users.find(x => x.username === e.target.u.value && x.password === e.target.p.value);
                    if(u) { setUser(u); setView('pos'); } else alert("Invalid Login");
                }}>
                    <Input name="u" placeholder="Username" defaultValue="admin" />
                    <Input name="p" type="password" placeholder="Password" defaultValue="123" />
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
                            <div className="font-mono text-primary font-bold">${p.price.toFixed(2)}</div>
                            {p.stock <= 0 && <div className="absolute top-2 right-2 bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded font-bold">OUT</div>}
                        </button>
                    ))}
                </div>

                {/* Floating Mobile Checkout Bar */}
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
                                    <div className="font-bold text-white">${cart.reduce((a,b)=>a+(b.price*b.quantity),0).toFixed(2)}</div>
                                </div>
                            </div>
                            <Button onClick={checkout} size="sm">Checkout</Button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const ReportsView = () => (
        <div className="animate-in flex flex-col gap-6 pb-24 lg:pb-0">
            <h2 className="text-2xl font-bold">Analytics</h2>
            <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-5 rounded-2xl relative overflow-hidden col-span-2 bg-gradient-to-br from-white/5 to-transparent">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Icon name="trending_up" size={64}/></div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider font-bold">Total Sales</div>
                    <div className="text-3xl font-bold mt-1 text-white">${data.sales.reduce((a,b)=>a+b.total,0).toFixed(2)}</div>
                </div>
                <div className="glass-card p-4 rounded-2xl">
                    <div className="text-xs text-gray-400 mb-1">Transactions</div>
                    <div className="text-xl font-bold">{data.sales.length}</div>
                </div>
                <div className="glass-card p-4 rounded-2xl">
                    <div className="text-xs text-gray-400 mb-1">Products</div>
                    <div className="text-xl font-bold">{data.products.length}</div>
                </div>
            </div>
        </div>
    );

    const InventoryView = () => (
        <div className="animate-in pb-24 lg:pb-0">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Inventory</h2>
                <Button onClick={() => {
                    const n = prompt("Item Name");
                    const p = Number(prompt("Price"));
                    const s = Number(prompt("Stock"));
                    if(n && p && s) updateData('products', [...data.products, { id: Date.now(), name: n, price: p, category: 'General', stock: s }]);
                }} size="sm"><Icon name="add"/> Add</Button>
            </div>
            <div className="grid gap-3">
                {data.products.map(p => (
                    <div key={p.id} className="glass-card p-3 rounded-xl flex items-center justify-between border-white/5">
                        <div>
                            <div className="font-bold text-white">{p.name}</div>
                            <div className="text-xs text-gray-400">${p.price}</div>
                        </div>
                        <div className="flex items-center gap-3 bg-surface-dark px-2 py-1 rounded-lg border border-white/5">
                            <button onClick={() => updateData('products', data.products.map(x => x.id===p.id ? {...x, stock: Math.max(0, x.stock-1)}:x))} className="text-gray-400 hover:text-white"><Icon name="remove" size={18}/></button>
                            <span className="w-6 text-center font-mono text-sm">{p.stock}</span>
                            <button onClick={() => updateData('products', data.products.map(x => x.id===p.id ? {...x, stock: x.stock+1}:x))} className="text-primary hover:text-white"><Icon name="add" size={18}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    // --- USERS VIEW ---
    const UsersView = () => {
        const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'Staff' });
        return (
            <div className="animate-in h-full overflow-y-auto pb-24 lg:pb-0">
                <h2 className="text-2xl font-bold mb-6">User Management</h2>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    
                    {/* User List - Left */}
                    <div className="lg:col-span-3 space-y-3">
                        {data.users.map(u => (
                            <div key={u.id} className="ref-card p-4 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
                                        {u.username[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white">{u.name || u.username}</div>
                                        <div className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-full w-fit mt-1">{u.role}</div>
                                    </div>
                                </div>
                                {u.username !== 'admin' && (
                                    <button className="text-gray-500 hover:text-red-400 transition-colors p-2" onClick={() => updateData('users', data.users.filter(x => x.id !== u.id))}>
                                        <Icon name="delete" size={20}/>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Create User Form - Right */}
                    <div className="lg:col-span-2">
                        <div className="ref-card p-6 rounded-2xl h-fit">
                            <h3 className="font-bold mb-4 flex items-center gap-2 text-lg">Create New User</h3>
                            <p className="text-xs text-gray-400 mb-4">Fill in the details below.</p>
                            <div className="space-y-4">
                                <Input label="FULL NAME" placeholder="e.g. John Doe" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                                <Input label="USERNAME" placeholder="e.g. john_d" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                                <Input label="PASSWORD" type="password" placeholder="••••••••" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                                
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider">ROLE</label>
                                    <select className="w-full px-4 py-3 bg-input-bg border border-white/5 rounded-xl outline-none text-white text-sm focus:ring-2 focus:ring-primary" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                                        <option value="Staff">Staff (POS Only)</option>
                                        <option value="Admin">Admin (Full Access)</option>
                                    </select>
                                </div>

                                <div className="pt-2">
                                    <Button className="w-full" onClick={() => {
                                        if(newUser.username && newUser.password) {
                                            updateData('users', [...data.users, { ...newUser, id: Date.now() }]);
                                            setNewUser({ name: '', username: '', password: '', role: 'Staff' });
                                        }
                                    }}>Create User</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- SETTINGS VIEW ---
    const SettingsView = () => (
        <div className="animate-in h-full overflow-y-auto pb-24 lg:pb-0">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full content-start">
                
                {/* Cloud Database Card */}
                <div className="lg:col-span-2">
                    <div className="ref-card p-6 rounded-2xl h-full flex flex-col">
                        <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                            <Icon name="cloud_sync" className="text-white"/> Cloud Database
                        </h3>
                        <p className="text-xs text-gray-400 mb-6">Connect to GitHub Gists to save data online for free.</p>
                        
                        <Input label="GITHUB TOKEN" type="password" value={ghConfig.token} onChange={e=>setGhConfig({...ghConfig, token: e.target.value})} placeholder="•••••••••••••••••••••" />
                        
                        <div className="flex gap-3 mb-6">
                            <div className="flex-1">
                                <Input label="DATABASE ID" value={ghConfig.gistId} onChange={e=>setGhConfig({...ghConfig, gistId: e.target.value})} placeholder="Gist ID" />
                            </div>
                            <div className="mt-[25px]">
                                <Button onClick={async () => {
                                    const res = await createGist(ghConfig.token, "POS_DB", data);
                                    if(res.id) setGhConfig({...ghConfig, gistId: res.id});
                                }} className="h-[46px] whitespace-nowrap bg-primary hover:bg-primary-hover">Create New</Button>
                            </div>
                        </div>
                        
                        <div className="flex gap-4 mt-auto">
                            <Button className="flex-1 bg-primary hover:bg-primary-hover py-3.5 text-sm" onClick={() => localStorage.setItem('gh_config', JSON.stringify(ghConfig))}>Save Config</Button>
                            <Button className="flex-1" variant="white" onClick={syncCloud}>Force Load</Button>
                        </div>
                    </div>
                </div>

                {/* Business Profile Card */}
                <div className="lg:col-span-3">
                    <div className="ref-card p-6 rounded-2xl h-full flex flex-col">
                        <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                            <Icon name="settings" className="text-white"/> Business Profile
                        </h3>
                        <p className="text-xs text-gray-400 mb-6">Details for Receipts & Reports.</p>
                        
                        <div className="space-y-4">
                            <Input label="BUSINESS NAME" value={data.profile.name} onChange={e => updateData('profile', {...data.profile, name: e.target.value})} />
                            
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="BUSINESS TYPE" value={data.profile.type} onChange={e => updateData('profile', {...data.profile, type: e.target.value})} />
                                <Input label="CONTACT NUMBER" value={data.profile.phone} onChange={e => updateData('profile', {...data.profile, phone: e.target.value})} />
                            </div>
                            
                            <Input label="ADDRESS" value={data.profile.address} onChange={e => updateData('profile', {...data.profile, address: e.target.value})} />
                            
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="LOCATION/CITY" value={data.profile.location} onChange={e => updateData('profile', {...data.profile, location: e.target.value})} />
                                <Input label="GST / TAX ID" value={data.profile.gst} onChange={e => updateData('profile', {...data.profile, gst: e.target.value})} />
                            </div>
                            
                            <Input label="LOGO URL (OPTIONAL)" value={data.profile.logo} onChange={e => updateData('profile', {...data.profile, logo: e.target.value})} placeholder="https://..." />
                        </div>

                        <div className="mt-6">
                            <Button className="w-full bg-primary hover:bg-primary-hover py-3.5 text-sm" onClick={()=>alert("Profile Saved")}>Save Business Profile</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // --- LAYOUT RENDER ---
    if(view === 'login') return <LoginView />;

    return (
        <div className="flex h-screen w-full relative overflow-hidden bg-background-dark">
            {/* Background Ambience */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-900/20 rounded-full blur-[100px]"></div>
            </div>

            {/* DESKTOP SIDEBAR (Hidden on mobile/tablet < lg) */}
            <aside className="hidden lg:flex w-64 surface-dark flex-col z-50 h-full border-r border-white/5">
                <div className="p-6">
                    <h1 className="text-2xl font-bold flex items-center gap-2"><span className="bg-primary px-2 py-0.5 rounded text-white text-lg">GL</span> POS</h1>
                    <div className="mt-6">
                        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/20 px-3 py-2 rounded-lg border border-emerald-500/20 w-fit">
                            <Icon name={isOnline ? "cloud_done" : "cloud_off"} size={16}/> {isOnline ? 'Cloud Synced' : 'Local'}
                        </div>
                    </div>
                </div>
                <nav className="flex-1 px-4 space-y-2 mt-4">
                    {[
                        { id: 'pos', icon: 'shopping_cart', label: 'POS' },
                        { id: 'inventory', icon: 'inventory_2', label: 'Inventory' },
                        { id: 'reports', icon: 'description', label: 'Reports' },
                        { id: 'users', icon: 'group', label: 'Users' },
                        { id: 'settings', icon: 'settings', label: 'Settings' }
                    ].map(item => (
                        <button key={item.id} onClick={() => setView(item.id)} 
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${view === item.id ? 'bg-primary text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                            <Icon name={item.icon} size={20}/> {item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 mt-auto border-t border-white/5">
                    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold">
                            {user.username[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold truncate text-white">{user.name}</div>
                            <div className="text-xs text-gray-500 truncate">{user.role}</div>
                        </div>
                        <button onClick={() => setView('login')} className="text-gray-500 group-hover:text-red-400 transition-colors"><Icon name="logout" size={20}/></button>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-full relative overflow-hidden z-0">
                {/* Mobile Top Header */}
                <header className="lg:hidden flex justify-between items-center p-4 glass-panel border-b-0 sticky top-0 z-20">
                    <h1 className="font-bold text-lg capitalize">{view}</h1>
                    <div className="flex gap-2">
                        <button onClick={() => setView('settings')} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><Icon name="settings" size={18}/></button>
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold">{user.username[0]}</div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 lg:p-8 no-scrollbar relative">
                    {view === 'pos' && <POSView />}
                    {view === 'inventory' && <InventoryView />}
                    {view === 'reports' && <ReportsView />}
                    {view === 'users' && <UsersView />}
                    {view === 'settings' && <SettingsView />}
                </div>

                {/* MOBILE BOTTOM NAV (Floating) */}
                <nav className="lg:hidden fixed bottom-6 left-6 right-6 glass-panel-heavy rounded-2xl flex justify-around items-center p-2 border border-white/10 shadow-2xl z-40">
                    <button onClick={() => setView('reports')} className={`p-3 rounded-xl flex flex-col items-center gap-1 ${view === 'reports' ? 'text-primary' : 'text-gray-500'}`}>
                        <Icon name="analytics" filled={view==='reports'} size={24}/>
                    </button>
                    <div className="relative -top-8">
                        <button onClick={() => setView('pos')} className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)] border-4 border-background-dark text-white">
                            <Icon name="point_of_sale" size={28}/>
                        </button>
                    </div>
                    <button onClick={() => setView('inventory')} className={`p-3 rounded-xl flex flex-col items-center gap-1 ${view === 'inventory' ? 'text-primary' : 'text-gray-500'}`}>
                        <Icon name="inventory_2" filled={view==='inventory'} size={24}/>
                    </button>
                </nav>
            </main>

            {/* Receipt Modal */}
            {receiptTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                        <div className="p-4 flex justify-between items-center border-b border-white/5">
                            <h3 className="font-bold">Receipt Generated</h3>
                            <button onClick={()=>setReceiptTx(null)}><Icon name="close"/></button>
                        </div>
                        <div className="p-6 bg-white text-black font-mono text-sm relative">
                            <div className="absolute top-0 left-0 w-full h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIxMCI+PGNpcmNsZSBjeD0iMTAiIGN5PSItNSIgcj0iMTAiIGZpbGw9IiMxZTI5M2IiLz48L3N2Zz4=')]"></div>
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
                                <span>${receiptTx.total.toFixed(2)}</span>
                            </div>
                            <div className="absolute bottom-0 left-0 w-full h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIxMCI+PGNpcmNsZSBjeD0iMTAiIGN5PSIxNSIgcj0iMTAiIGZpbGw9IiMxZTI5M2IiLz48L3N2Zz4=')]"></div>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-3">
                            <Button onClick={() => window.print()} variant="secondary"><Icon name="print"/> Print</Button>
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
