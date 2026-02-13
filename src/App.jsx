import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

function App() {

  const [view, setView] = useState("login");
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);

  const [data, setData] = useState(() => {
    const saved = localStorage.getItem("glass_pos_data");
    return saved ? JSON.parse(saved) : {
      products: [
        { id: 1, name: "Masala Chai", price: 15, stock: 100 },
        { id: 2, name: "Coffee", price: 25, stock: 80 }
      ],
      sales: []
    };
  });

  useEffect(() => {
    localStorage.setItem("glass_pos_data", JSON.stringify(data));
  }, [data]);

  // LOGIN
  const login = (e) => {
    e.preventDefault();
    const u = e.target.username.value;
    const p = e.target.password.value;

    if (u === "admin" && p === "123") {
      setUser({ role: "Admin", name: "Admin" });
      setView("pos");
    } else {
      alert("Invalid login");
    }
  };

  // ADD TO CART
  const addToCart = (product) => {
    if (product.stock <= 0) return;

    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) {
        return prev.map(i =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });

    setData(prev => ({
      ...prev,
      products: prev.products.map(p =>
        p.id === product.id ? { ...p, stock: p.stock - 1 } : p
      )
    }));
  };

  const total = cart.reduce((a,b)=>a+b.price*b.quantity,0);

  const checkout = () => {
    if(cart.length===0) return;

    const sale = {
      id: Date.now(),
      date: new Date().toISOString(),
      total
    };

    setData(prev => ({
      ...prev,
      sales: [sale, ...prev.sales]
    }));

    setCart([]);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text("GLASS POS BILL", 14, 15);

    autoTable(doc,{
      head:[["Item","Qty","Price"]],
      body: cart.map(i=>[
        i.name,
        i.quantity,
        i.price*i.quantity
      ])
    });

    doc.text(`Total: ₹${total}`, 14, 100);
    doc.save("bill.pdf");
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data.sales);
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    XLSX.writeFile(wb, "sales.xlsx");
  };

  if(!user){
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="glass p-8 rounded-xl w-80">
          <h2 className="text-xl mb-4 text-center">Glass POS Login</h2>
          <form onSubmit={login}>
            <input name="username" placeholder="Username" className="w-full mb-3 p-2 text-black rounded"/>
            <input name="password" type="password" placeholder="Password" className="w-full mb-4 p-2 text-black rounded"/>
            <button className="w-full bg-indigo-600 py-2 rounded">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Glass POS</h1>
        <button onClick={()=>setUser(null)} className="bg-red-500 px-3 py-1 rounded">Logout</button>
      </div>

      <h2 className="mb-3 text-lg">Products</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        {data.products.map(p=>(
          <div key={p.id} className="glass p-4 rounded">
            <h3>{p.name}</h3>
            <p>₹{p.price}</p>
            <p>Stock: {p.stock}</p>
            <button onClick={()=>addToCart(p)} className="mt-2 bg-green-600 px-3 py-1 rounded">Add</button>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg">Cart</h2>
      {cart.map(i=>(
        <div key={i.id}>{i.name} x {i.quantity}</div>
      ))}

      <h3 className="mt-4 text-xl">Total: ₹{total}</h3>

      <div className="mt-4 space-x-3">
        <button onClick={checkout} className="bg-purple-600 px-4 py-2 rounded">Checkout</button>
        <button onClick={generatePDF} className="bg-blue-600 px-4 py-2 rounded">PDF</button>
        <button onClick={exportExcel} className="bg-yellow-600 px-4 py-2 rounded">Excel</button>
      </div>
    </div>
  );
}

export default App;
