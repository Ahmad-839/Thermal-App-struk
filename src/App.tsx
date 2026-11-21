import React, { useState, useEffect, createContext, useContext } from 'react';
import { Settings, Plus, Printer, RefreshCw, Trash2, Edit, Store, FileText, History, Save, Database, User, CheckCircle2, AlertCircle } from 'lucide-react';

// --- TYPES ---
export type StoreData = {
  id: string;
  name: string;
  storeType: 'retail' | 'spbu';
  spbuNumber?: string;
  spbuProducts?: string; 
  spbuOperators?: string; 
  address1: string;
  address2?: string;
  phone: string;
  templateId: string;
  logoUrl?: string;
  footerText?: string;
  fontFamily?: string;
};

export type TemplateData = {
  id: string;
  name: string;
  type: 'complete' | 'minimal' | 'compact' | 'spbu';
  showLogo: boolean;
  showCashier: boolean;
  alignCenter: boolean;
  footerMessage: string;
};

export type CartItem = {
  id: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  subtotal: number;
};

export type SpbuData = {
  shift: string;
  pompa: string;
  noKendaraan: string;
};

export type Transaction = {
  id: string;
  receiptNo: string;
  storeId: string;
  templateId: string;
  cashierName: string;
  date: string; 
  time: string; 
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment: number;
  change: number;
  status: 'printed' | 'saved';
  spbuData?: SpbuData;
};

export type AppSettings = {
  receiptPrefix: string;
  receiptDigits: number;
  receiptMode: 'random' | 'sequential';
  dateMode: 'auto' | 'manual';
  manualDate: string;
  manualTime: string;
};

// --- INITIAL DATA ---
const DEMO_TEMPLATES: TemplateData[] = [
  { id: 'tpl-1', name: 'Template Lengkap', type: 'complete', showLogo: true, showCashier: true, alignCenter: true, footerMessage: 'TERIMA KASIH\nSELAMAT DATANG KEMBALI' },
  { id: 'tpl-2', name: 'Template Minimalis', type: 'minimal', showLogo: false, showCashier: true, alignCenter: false, footerMessage: 'TERIMA KASIH' },
  { id: 'tpl-spbu', name: 'Template SPBU (Pertamina)', type: 'spbu', showLogo: true, showCashier: true, alignCenter: true, footerMessage: 'TERIMA KASIH ATAS KUNJUNGAN\nKE SPBU KAMI\n\n* CUSTOMER COPY *' }
];

const DEMO_STORES: StoreData[] = [
  { id: 'store-1', name: 'TOKO MAKMUR', storeType: 'retail', address1: 'Jl. Raya Ambulu No. 12', phone: '08123456789', templateId: 'tpl-1', fontFamily: "'Courier New', Courier, monospace", footerText: 'TERIMA KASIH\nBARANG YANG SUDAH DIBELI TIDAK BISA DIKEMBALIKAN' },
  { id: 'store-spbu', name: 'SPBU PERTAMINA AMBULU', storeType: 'spbu', spbuNumber: '54.681.01', spbuProducts: 'PERTAMAX:16250, PERTALITE:10000, BIOSOLAR:6800, DEXLITE:15000', spbuOperators: 'Joko Irwanto, Antika, Suciwati, Budi', address1: 'Jl. Manggar No. 140, Tegalsari, Ambulu', phone: '(0336) 881176', templateId: 'tpl-spbu', fontFamily: "'Courier New', Courier, monospace", logoUrl: 'https://i.ibb.co.com/qYhx8CrJ/Whats-App-Image-2026-11-21-at-13-26-16.jpg' }
];

const DEFAULT_SETTINGS: AppSettings = {
  receiptPrefix: 'TRX-',
  receiptDigits: 6,
  receiptMode: 'random',
  dateMode: 'auto',
  manualDate: new Date().toISOString().split('T')[0],
  manualTime: '08:00:00'
};

// --- UTILS ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const formatDateToLocale = (dateStr: string) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

const getSpbuProducts = (str?: string) => {
  if (!str) return [];
  return str.split(',').map(s => {
    const [name, price] = s.split(':');
    return { name: name?.trim().toUpperCase(), price: Number(price?.trim() || 0) };
  }).filter(p => p.name && p.price > 0);
};

const getSpbuOperators = (str?: string) => {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
};

const generateUniqueReceiptNo = (settings: AppSettings, transactions: Transaction[]) => {
  let isUnique = false;
  let newNo = '';
  let attempt = 0;
  
  while (!isUnique && attempt < 1000) {
    if (settings.receiptMode === 'random') {
      const randomNum = Math.floor(Math.random() * Math.pow(10, settings.receiptDigits)).toString().padStart(settings.receiptDigits, '0');
      newNo = `${settings.receiptPrefix}${randomNum}`;
    } else {
      const currentCount = transactions.length + 1 + attempt;
      const seqNum = currentCount.toString().padStart(settings.receiptDigits, '0');
      newNo = `${settings.receiptPrefix}${seqNum}`;
    }
    
    isUnique = !transactions.some(t => t.receiptNo === newNo);
    attempt++;
  }
  return newNo;
};

// --- CONTEXT ---
type AppContextType = {
  stores: StoreData[];
  setStores: React.Dispatch<React.SetStateAction<StoreData[]>>;
  templates: TemplateData[];
  setTemplates: React.Dispatch<React.SetStateAction<TemplateData[]>>;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  activeStoreId: string;
  setActiveStoreId: (id: string) => void;
  printData: Transaction | null;
  triggerPrint: (tx: Transaction) => void;
  showToast: (msg: string, type?: 'success'|'error'|'info') => void;
  askConfirmation: (msg: string, onConfirm: () => void) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stores, setStores] = useState<StoreData[]>(() => JSON.parse(localStorage.getItem('stores') || 'null') || DEMO_STORES);
  const [templates, setTemplates] = useState<TemplateData[]>(() => JSON.parse(localStorage.getItem('templates') || 'null') || DEMO_TEMPLATES);
  const [settings, setSettings] = useState<AppSettings>(() => JSON.parse(localStorage.getItem('settings') || 'null') || DEFAULT_SETTINGS);
  const [transactions, setTransactions] = useState<Transaction[]>(() => JSON.parse(localStorage.getItem('transactions') || 'null') || []);
  const [activeStoreId, setActiveStoreId] = useState<string>(() => localStorage.getItem('activeStoreId') || stores[0]?.id || '');
  const [printData, setPrintData] = useState<Transaction | null>(null);
  
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'info'} | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{msg: string, onConfirm: () => void} | null>(null);

  useEffect(() => { localStorage.setItem('stores', JSON.stringify(stores)); }, [stores]);
  useEffect(() => { localStorage.setItem('templates', JSON.stringify(templates)); }, [templates]);
  useEffect(() => { localStorage.setItem('settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('activeStoreId', activeStoreId); }, [activeStoreId]);

  const triggerPrint = (tx: Transaction) => {
    setPrintData(tx);
    setTimeout(() => {
      window.print();
      setPrintData(null);
    }, 500);
  };

  const showToast = (msg: string, type: 'success'|'error'|'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <AppContext.Provider value={{ stores, setStores, templates, setTemplates, settings, setSettings, transactions, setTransactions, activeStoreId, setActiveStoreId, printData, triggerPrint, showToast, askConfirmation: (msg, onConfirm) => setConfirmDialog({msg, onConfirm}) }}>
      {children}
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-bounce">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-blue-600' : 'bg-green-600'}`}>
            {toast.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}
            <p className="font-semibold text-sm">{toast.msg}</p>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Konfirmasi</h3>
            <p className="text-gray-600 mb-6">{confirmDialog.msg}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md font-medium">Batal</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700">Ya, Lanjutkan</button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};

// --- RECEIPT RENDERER (THERMAL ENGINE 57mm) ---
const ReceiptRenderer = ({ transaction, isPrintMode = false }: { transaction: Transaction, isPrintMode?: boolean }) => {
  const { stores, templates } = useAppContext();
  const store = stores.find(s => s.id === transaction.storeId) || stores[0];
  const template = templates.find(t => t.id === transaction.templateId) || templates[0];

  const wrapperClass = isPrintMode 
    ? "w-[57mm] mx-auto bg-white text-black text-[10.5px] leading-tight p-1" 
    : "w-[210px] mx-auto bg-white shadow-md p-3 text-black text-[10.5px] leading-tight border border-gray-200 select-none";

  const storeFont = store.fontFamily || "'Courier New', Courier, monospace";

  const Divider = ({ double = false }: { double?: boolean }) => (
    <div className={`my-1 w-full ${double ? 'border-b-2' : 'border-b-[1.5px]'} border-dashed border-black`} />
  );

  // === RENDERER KHUSUS SPBU ===
  if (store.storeType === 'spbu') {
    return (
      <div className={wrapperClass} style={{ boxSizing: 'border-box', overflow: 'hidden', fontFamily: storeFont }}>
        <div className="text-center font-bold text-black pb-1">
           {template.showLogo && (
             <img 
               src={store.logoUrl || "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Pertamina_Logo.svg/256px-Pertamina_Logo.svg.png"} 
               onError={(e) => { e.currentTarget.style.display = 'none'; }}
               style={{ filter: 'grayscale(100%) contrast(200%)' }} 
               alt="Logo" 
               className="max-w-[120px] mx-auto mb-2" 
             />
           )}
           <div className="text-[13px] uppercase tracking-wide leading-snug">{store.name}</div>
           <div className="whitespace-pre-wrap text-[10px] uppercase font-semibold">
             {store.spbuNumber ? store.spbuNumber + ', ' : ''}{store.address1}
           </div>
           <div className="text-[10px] font-semibold">Telp. {store.phone}</div>
        </div>

        {transaction.spbuData && (
          <div className="text-[11px] mt-2 mb-1 font-bold text-black space-y-0.5">
             <div className="flex">
               <div className="w-[12ch]">Shift</div>
               <div>: {transaction.spbuData.shift}</div>
             </div>
             <div className="flex">
               <div className="w-[12ch]">No. Trans</div>
               <div>: {transaction.receiptNo}</div>
             </div>
             <div className="flex">
               <div className="w-[12ch]">Waktu</div>
               <div>: {formatDateToLocale(transaction.date)} {transaction.time}</div>
             </div>
          </div>
        )}

        <Divider />

        {transaction.spbuData && transaction.items[0] && (
          <div className="text-[11px] font-bold text-black space-y-0.5 my-1.5">
             <div className="flex">
               <div className="w-[12ch]">Pulau/Pompa</div>
               <div>: {transaction.spbuData.pompa}</div>
             </div>
             <div className="flex">
               <div className="w-[12ch]">Nama Produk</div>
               <div>: {transaction.items[0].name}</div>
             </div>
             <div className="flex">
               <div className="w-[12ch]">Harga/Liter</div>
               <div>: Rp. {transaction.items[0].price.toLocaleString('id-ID')}</div>
             </div>
             <div className="flex">
               <div className="w-[12ch]">Volume</div>
               <div>: (L) {transaction.items[0].qty.toFixed(3)}</div>
             </div>
             <div className="flex">
               <div className="w-[12ch]">Total Harga</div>
               <div>: Rp. {transaction.items[0].subtotal.toLocaleString('id-ID')}</div>
             </div>
             <div className="flex">
               <div className="w-[12ch]">Operator</div>
               <div className="uppercase">: {transaction.cashierName}</div>
             </div>
          </div>
        )}
        
        {transaction.spbuData && (
          <>
            <div className="mt-3 mb-1 text-[12px] font-bold text-black">CASH</div>
            <div className="text-right text-[12px] font-bold text-black mb-2">Rp. {transaction.payment.toLocaleString('id-ID')}</div>
            <Divider />
            <div className="text-[11px] font-bold text-black mt-1.5 flex uppercase">
               <div className="w-[12ch]">No. Kend.</div>
               <div>: {transaction.spbuData.noKendaraan || '-'}</div>
            </div>
          </>
        )}

        <div className="text-center whitespace-pre-wrap text-[10px] mt-4 mb-1 font-bold text-black">
          {template.footerMessage || store.footerText || "TERIMA KASIH"}
        </div>
      </div>
    );
  }

  // === RENDERER TOKO RETAIL ===
  return (
    <div className={wrapperClass} style={{ boxSizing: 'border-box', overflow: 'hidden', fontFamily: storeFont }}>
      {/* HEADER */}
      <div className={`${template.alignCenter ? "text-center" : "text-left"} text-black`}>
        {template.showLogo && store.logoUrl && (
           <img src={store.logoUrl} onError={(e) => { e.currentTarget.style.display = 'none'; }} alt="Logo" className={`max-w-[100px] max-h-[60px] object-contain mb-2 ${template.alignCenter ? 'mx-auto' : ''}`} style={{ filter: 'grayscale(100%)' }} />
        )}
        <div className="font-bold text-[13px] uppercase leading-snug">{store.name}</div>
        <div className="whitespace-pre-wrap text-[11px] font-semibold">{store.address1}</div>
        {store.address2 && <div className="whitespace-pre-wrap text-[11px] font-semibold">{store.address2}</div>}
        <div className="text-[11px] font-semibold">Telp: {store.phone}</div>
      </div>
      
      <Divider double={template.type === 'complete'} />

      {/* INFO META */}
      <div className="text-[11px] space-y-0.5 font-bold text-black">
        <div className="flex justify-between">
          <span>NO RESI</span>
          <span>{transaction.receiptNo}</span>
        </div>
        <div className="flex justify-between">
          <span>TGL/JAM</span>
          <span>{formatDateToLocale(transaction.date)} {transaction.time}</span>
        </div>
        {template.showCashier && transaction.cashierName && (
           <div className="flex justify-between">
             <span>KASIR</span>
             <span className="uppercase">{transaction.cashierName}</span>
           </div>
        )}
      </div>

      <Divider />

      {/* ITEMS */}
      {template.type === 'complete' && (
        <>
          <div className="flex justify-between font-bold text-black text-[11px] mb-0.5">
            <span>ITEM</span>
            <span>TOTAL</span>
          </div>
          <Divider />
        </>
      )}

      <div className="space-y-1.5 text-black font-semibold">
        {transaction.items.map((item, idx) => (
          <div key={idx} className="text-[11px]">
            <div className="font-bold break-words uppercase">{item.name}</div>
            <div className="flex justify-between pl-1">
              <span>{item.qty} x {item.price.toLocaleString('id-ID')}</span>
              <span className="font-bold">{item.subtotal.toLocaleString('id-ID')}</span>
            </div>
          </div>
        ))}
      </div>

      <Divider />

      {/* TOTALS */}
      <div className="space-y-0.5 text-[11px] font-bold text-black">
        {(template.type === 'complete' || transaction.discount > 0) && (
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{transaction.subtotal.toLocaleString('id-ID')}</span>
          </div>
        )}
        {transaction.discount > 0 && (
          <div className="flex justify-between">
            <span>Diskon</span>
            <span>-{transaction.discount.toLocaleString('id-ID')}</span>
          </div>
        )}
        <div className="flex justify-between text-[12px] pt-1 border-t-[1.5px] border-black mt-1">
          <span>TOTAL</span>
          <span>{transaction.total.toLocaleString('id-ID')}</span>
        </div>
        <div className="flex justify-between pt-0.5">
          <span>Bayar</span>
          <span>{transaction.payment.toLocaleString('id-ID')}</span>
        </div>
        <div className="flex justify-between">
          <span>Kembali</span>
          <span>{transaction.change.toLocaleString('id-ID')}</span>
        </div>
      </div>

      <Divider double={template.type === 'complete'} />

      {/* FOOTER */}
      <div className="text-center whitespace-pre-wrap text-[10px] mt-2 mb-1 uppercase font-bold text-black">
        {template.footerMessage || store.footerText || "TERIMA KASIH"}
      </div>
    </div>
  );
};


// --- UI COMPONENTS ---
const Button = ({ children, onClick, variant = 'primary', className = '', disabled=false, title='', type='button' }: any) => {
  const base = "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${base} ${variants[variant as keyof typeof variants]} ${className}`}>{children}</button>;
};

const Input = ({ label, name, type = 'text', required = false, defaultValue = '', placeholder = '' }: any) => (
  <div className="mb-3">
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input type={type} name={name} required={required} defaultValue={defaultValue} placeholder={placeholder} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm" />
  </div>
);

// --- VIEWS ---
const PosView = () => {
  const { stores, settings, setSettings, activeStoreId, setActiveStoreId, transactions, setTransactions, triggerPrint, showToast } = useAppContext();
  const store = stores.find(s => s.id === activeStoreId) || stores[0];
  
  const [cashierName, setCashierName] = useState('');
  const [receiptNo, setReceiptNo] = useState(() => generateUniqueReceiptNo(settings, transactions));
  
  // Date Time State
  const [manualDate, setManualDate] = useState(settings.manualDate);
  const [manualTime, setManualTime] = useState(settings.manualTime);
  const [currentAutoTime, setCurrentAutoTime] = useState(new Date());

  useEffect(() => {
    if (settings.dateMode === 'auto') {
      const timer = setInterval(() => setCurrentAutoTime(new Date()), 1000);
      return () => clearInterval(timer);
    }
  }, [settings.dateMode]);

  const dateStr = settings.dateMode === 'auto' ? currentAutoTime.toISOString().split('T')[0] : manualDate;
  const timeStr = settings.dateMode === 'auto' ? currentAutoTime.toLocaleTimeString('id-ID', {hour12:false}) : manualTime;

  // Retail State
  const [items, setItems] = useState<CartItem[]>([]);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState<number | ''>('');
  const [itemPrice, setItemPrice] = useState<number | ''>('');
  
  const [discount, setDiscount] = useState<number | ''>('');
  const [payment, setPayment] = useState<number | ''>('');

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const numDiscount = Number(discount) || 0;
  const numPayment = Number(payment) || 0;
  const total = Math.max(0, subtotal - numDiscount);
  const change = numPayment >= total ? numPayment - total : 0;

  // SPBU State
  const spbuProducts = getSpbuProducts(store.spbuProducts);
  const spbuOperators = getSpbuOperators(store.spbuOperators);
  
  const [spbuShift, setSpbuShift] = useState('1');
  const [spbuPompa, setSpbuPompa] = useState('1');
  const [spbuKendaraan, setSpbuKendaraan] = useState('');
  const [spbuAmount, setSpbuAmount] = useState<number | ''>('');
  const [spbuSelectedProdName, setSpbuSelectedProdName] = useState('');

  // Sinkronisasi default produk dan operator SPBU
  useEffect(() => {
    if (store.storeType === 'spbu') {
      if (spbuProducts.length > 0 && !spbuSelectedProdName) setSpbuSelectedProdName(spbuProducts[0].name);
      if (spbuOperators.length > 0 && !cashierName) setCashierName(spbuOperators[0]);
    }
  }, [store.storeType, spbuProducts, spbuOperators, spbuSelectedProdName, cashierName]);

  const selectedProd = spbuProducts.find(p => p.name === spbuSelectedProdName) || { name: 'BBM', price: 10000 };
  const spbuVolume = (Number(spbuAmount) / selectedProd.price) || 0;

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !itemQty || !itemPrice) return;
    const qty = Number(itemQty);
    const price = Number(itemPrice);
    
    setItems([...items, {
      id: generateId(),
      name: itemName,
      qty,
      unit: 'pcs',
      price,
      subtotal: qty * price
    }]);
    
    setItemName('');
    setItemQty('');
    setItemPrice('');
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const handleGenerateReceipt = () => {
    const newNo = generateUniqueReceiptNo(settings, transactions);
    setReceiptNo(newNo);
    showToast(`Nomor Resi Baru: ${newNo}`, "info");
  };

  const currentTransaction: Transaction = store.storeType === 'spbu' ? {
    id: generateId(),
    receiptNo,
    storeId: store.id,
    templateId: store.templateId,
    cashierName: cashierName || 'OPERATOR',
    date: dateStr,
    time: timeStr,
    items: [{
      id: 'prod',
      name: selectedProd.name,
      qty: spbuVolume,
      unit: 'L',
      price: selectedProd.price,
      subtotal: Number(spbuAmount)
    }],
    subtotal: Number(spbuAmount),
    discount: 0,
    tax: 0,
    total: Number(spbuAmount),
    payment: Number(spbuAmount),
    change: 0,
    status: 'saved',
    spbuData: {
      shift: spbuShift,
      pompa: spbuPompa,
      noKendaraan: spbuKendaraan
    }
  } : {
    id: generateId(),
    receiptNo,
    storeId: store.id,
    templateId: store.templateId,
    cashierName: cashierName || 'KASIR',
    date: dateStr,
    time: timeStr,
    items,
    subtotal,
    discount: numDiscount,
    tax: 0,
    total,
    payment: numPayment,
    change,
    status: 'saved'
  };

  const handleSaveAndPrint = () => {
    if (store.storeType === 'spbu') {
      if (!spbuAmount || Number(spbuAmount) <= 0) {
        showToast("Nominal pembelian BBM belum diisi!", "error");
        return;
      }
    } else {
      if (items.length === 0) {
        showToast("Keranjang belanja masih kosong!", "error");
        return;
      }
      if (numPayment < total) {
        showToast("Nominal pembayaran masih kurang!", "error");
        return;
      }
    }

    const finalTx = { ...currentTransaction, status: 'printed' as const };
    
    setTransactions(prev => [finalTx, ...prev]);
    triggerPrint(finalTx);

    // Reset Form
    if (store.storeType === 'spbu') {
      setSpbuAmount('');
      setSpbuKendaraan('');
    } else {
      setItems([]);
      setPayment('');
      setDiscount('');
    }
    setReceiptNo(generateUniqueReceiptNo(settings, [...transactions, finalTx]));
    showToast("Transaksi berhasil dicetak!", "success");
  };

  const handleTestPrint = () => {
    const dummyTx: Transaction = {
      ...currentTransaction,
      receiptNo: 'TEST-PRINT-123',
      cashierName: 'TEST KASIR',
      items: [{id: '1', name: 'TEST ITEM PRINT', qty: 1, unit: 'pcs', price: 10000, subtotal: 10000}],
      subtotal: 10000, total: 10000, payment: 10000, change: 0
    };
    triggerPrint(dummyTx);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full relative">
      <div className="flex-1 overflow-y-auto space-y-4">
        
        {/* KOTAK PEMILIHAN TOKO / SPBU YANG JELAS */}
        <div className={`p-4 rounded-lg shadow-sm border-2 flex items-center justify-between transition-colors ${store.storeType === 'spbu' ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-300'}`}>
           <div className="flex-1">
             <label className="block text-xs font-bold text-gray-700 mb-1">PILIH LOKASI TRANSAKSI (TOKO / SPBU)</label>
             <select value={activeStoreId} onChange={e => setActiveStoreId(e.target.value)} className="w-full md:w-3/4 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm font-semibold p-2 border">
               {stores.map(s => <option key={s.id} value={s.id}>{s.name} - {s.storeType === 'spbu' ? '(Mode SPBU Pertamina)' : '(Mode Toko Retail)'}</option>)}
             </select>
           </div>
           <div className={`hidden md:block px-4 py-2 rounded text-sm font-bold border ${store.storeType === 'spbu' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
              MODE: {store.storeType === 'spbu' ? 'SPBU' : 'RETAIL'}
           </div>
        </div>

        {/* Date Time Settings Box */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap gap-4 items-center justify-between text-sm shadow-sm">
          <div className="flex items-center gap-3">
             <span className="font-semibold text-gray-700">Waktu Cetak:</span>
             <button type="button" onClick={() => setSettings({...settings, dateMode: settings.dateMode === 'auto' ? 'manual' : 'auto'})} className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${settings.dateMode === 'auto' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
               {settings.dateMode === 'auto' ? 'Otomatis' : 'Manual (Edit)'}
             </button>
          </div>
          <div className="flex gap-2">
            <input type="date" value={dateStr} onChange={e => setManualDate(e.target.value)} disabled={settings.dateMode === 'auto'} className="border rounded px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
            <input type="time" step="1" value={timeStr} onChange={e => setManualTime(e.target.value)} disabled={settings.dateMode === 'auto'} className="border rounded px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
        </div>

        {/* Transaction Meta Settings */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          {store.storeType !== 'spbu' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nama Kasir</label>
              <div className="flex relative">
                 <User className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                 <input type="text" value={cashierName} onChange={e => setCashierName(e.target.value)} placeholder="Opsional" className="w-full pl-9 pr-3 py-1.5 border rounded-md text-sm" />
              </div>
            </div>
          )}
          <div className={store.storeType === 'spbu' ? "md:col-span-2" : ""}>
            <label className="block text-xs font-medium text-gray-700 mb-1">No. Resi / Transaksi</label>
            <div className="flex gap-2">
              <input type="text" value={receiptNo} onChange={e => setReceiptNo(e.target.value)} className="w-full px-3 py-1.5 border rounded-md text-sm font-mono" />
              <Button onClick={handleGenerateReceipt} variant="secondary" title="Acak Nomor Resi"><RefreshCw size={14}/></Button>
            </div>
          </div>
        </div>

        {/* INPUT AREA (SPBU vs RETAIL) */}
        {store.storeType === 'spbu' ? (
          
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-red-500">
            <h3 className="font-bold text-gray-800 mb-3 border-b pb-2 flex items-center gap-2">
              Input Transaksi SPBU
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Operator</label>
                <select value={cashierName} onChange={e => setCashierName(e.target.value)} className="w-full border px-3 py-1.5 rounded-md text-sm bg-gray-50">
                  <option value="">Pilih Operator</option>
                  {spbuOperators.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Pilih Produk BBM</label>
                <select value={spbuSelectedProdName} onChange={e => setSpbuSelectedProdName(e.target.value)} className="w-full border px-3 py-1.5 rounded-md text-sm font-semibold bg-red-50 text-red-700">
                  {spbuProducts.map(p => <option key={p.name} value={p.name}>{p.name} (Rp{p.price.toLocaleString('id-ID')})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Shift Ke-</label>
                <input type="number" min="1" value={spbuShift} onChange={e => setSpbuShift(e.target.value)} className="w-full border px-3 py-1.5 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Pulau / Pompa</label>
                <input type="number" min="1" value={spbuPompa} onChange={e => setSpbuPompa(e.target.value)} className="w-full border px-3 py-1.5 rounded-md text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">No. Plat Kendaraan (Opsional)</label>
                <input type="text" value={spbuKendaraan} onChange={e => setSpbuKendaraan(e.target.value.toUpperCase())} className="w-full border px-3 py-1.5 rounded-md text-sm font-mono uppercase" placeholder="P 1234 XX" />
              </div>
            </div>
            
            <div className="bg-gray-100 p-4 rounded-md border border-gray-200 mt-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">Total Pembelian (CASH)</label>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-gray-500">Rp</span>
                <input type="number" min="0" value={spbuAmount} onChange={e => setSpbuAmount(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border-2 border-red-400 focus:border-red-600 rounded-md px-3 py-2 text-2xl font-bold text-gray-900" placeholder="100000" />
              </div>
              <div className="mt-3 flex justify-between items-center border-t border-gray-300 pt-2">
                <span className="text-sm text-gray-500">Estimasi Volume Keluar:</span>
                <span className="font-bold text-red-600 text-xl">{spbuVolume.toFixed(3)} Liter</span>
              </div>
            </div>

            <Button className="w-full py-4 mt-5 text-base shadow-md font-bold bg-red-600 hover:bg-red-700" onClick={handleSaveAndPrint} disabled={!spbuAmount}>
                <Printer size={20} /> CETAK STRUK SPBU
            </Button>
          </div>

        ) : (
          <>
            {/* Item Entry Form RETAIL */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-blue-500">
              <h3 className="font-bold text-gray-800 mb-3 border-b pb-2">Keranjang Belanja (Retail)</h3>
              <form onSubmit={handleAddItem} className="flex flex-wrap md:flex-nowrap gap-2 items-end">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nama Barang</label>
                  <input type="text" required value={itemName} onChange={e => setItemName(e.target.value)} className="w-full border px-3 py-1.5 rounded-md text-sm" placeholder="Contoh: Kopi Susu" />
                </div>
                <div className="w-20">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Qty</label>
                  <input type="number" min="1" required value={itemQty} onChange={e => setItemQty(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border px-3 py-1.5 rounded-md text-sm" placeholder="1" />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Harga</label>
                  <input type="number" min="0" required value={itemPrice} onChange={e => setItemPrice(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border px-3 py-1.5 rounded-md text-sm" placeholder="0" />
                </div>
                <Button type="submit" className="mb-[1px]"><Plus size={18}/> Tambah</Button>
              </form>

              <div className="mt-4 border rounded-md overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2">Barang</th>
                      <th className="px-3 py-2 w-16 text-center">Qty</th>
                      <th className="px-3 py-2 w-24 text-right">Harga</th>
                      <th className="px-3 py-2 w-24 text-right">Total</th>
                      <th className="px-3 py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Belum ada barang di keranjang</td></tr>}
                    {items.map(item => (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{item.name}</td>
                        <td className="px-3 py-2 text-center">{item.qty}</td>
                        <td className="px-3 py-2 text-right">{item.price.toLocaleString('id-ID')}</td>
                        <td className="px-3 py-2 text-right font-semibold">{item.subtotal.toLocaleString('id-ID')}</td>
                        <td className="px-3 py-2 text-center"><button onClick={()=>handleRemoveItem(item.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Calculation Section RETAIL */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-2 text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">Rp {subtotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center mb-4 text-sm">
                <span className="text-gray-600">Diskon (Rp)</span>
                <input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value === '' ? '' : Number(e.target.value))} className="w-32 border px-2 py-1 rounded text-right" placeholder="0" />
              </div>
              <div className="flex justify-between items-center py-3 border-y border-dashed text-lg font-bold text-gray-800">
                <span>TOTAL BELANJA</span>
                <span>Rp {total.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center mt-4">
                <span className="text-sm font-semibold text-gray-700">BAYAR CASH</span>
                <input type="number" min="0" value={payment} onChange={e => setPayment(e.target.value === '' ? '' : Number(e.target.value))} className="w-40 border-2 border-blue-400 px-3 py-2 rounded-md text-right font-bold text-lg" placeholder="0" />
              </div>
              <div className="flex justify-between items-center mt-3 text-lg font-bold text-green-600">
                <span>KEMBALIAN</span>
                <span>Rp {change.toLocaleString('id-ID')}</span>
              </div>
              
              <Button className="w-full py-3 mt-5 text-base shadow-md font-bold" onClick={handleSaveAndPrint} disabled={items.length === 0}>
                  <Printer size={20} /> SIMPAN & CETAK STRUK RETAIL
              </Button>
            </div>
          </>
        )}
      </div>

      {/* RIGHT REALTIME PREVIEW */}
      <div className="w-full lg:w-[320px] shrink-0">
         <div className="bg-gray-800 rounded-t-lg p-3 text-white flex justify-between items-center">
            <span className="font-semibold text-sm">PREVIEW THERMAL 57MM</span>
            <Button variant="outline" onClick={handleTestPrint} className="text-xs py-1 px-2 border-gray-600 text-gray-200 hover:bg-gray-700"><Printer size={12}/> Test Print</Button>
         </div>
         <div className="bg-gray-200 p-4 h-[calc(100vh-200px)] overflow-y-auto rounded-b-lg flex flex-col items-center custom-scrollbar shadow-inner border border-gray-300">
            <ReceiptRenderer transaction={currentTransaction} />
         </div>
      </div>
    </div>
  );
};

const StoresView = () => {
  const { stores, setStores, templates, showToast, askConfirmation } = useAppContext();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<'retail' | 'spbu'>('retail');
  
  const handleEditInit = (id: string) => {
    setEditingId(id);
    const s = stores.find(s => s.id === id);
    if (s) setEditingType(s.storeType || 'retail');
    else setEditingType('retail');
  }

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const storeObj: StoreData = {
      id: editingId === 'new' ? generateId() : editingId!,
      name: fd.get('name') as string,
      storeType: editingType,
      address1: fd.get('address1') as string,
      phone: fd.get('phone') as string,
      templateId: fd.get('templateId') as string,
      logoUrl: fd.get('logoUrl') as string,
      footerText: fd.get('footerText') as string,
      fontFamily: fd.get('fontFamily') as string,
      spbuNumber: fd.get('spbuNumber') as string || undefined,
      spbuProducts: fd.get('spbuProducts') as string || undefined,
      spbuOperators: fd.get('spbuOperators') as string || undefined,
    };

    if (editingId === 'new') {
      setStores([...stores, storeObj]);
      showToast("Toko berhasil ditambahkan!");
    } else {
      setStores(stores.map(s => s.id === editingId ? storeObj : s));
      showToast("Data toko berhasil diperbarui!");
    }
    setEditingId(null);
  };

  const deleteStore = (id: string) => {
    if(stores.length <= 1) return showToast("Minimal harus ada 1 toko aktif!", "error");
    askConfirmation("Hapus toko ini secara permanen?", () => {
      setStores(stores.filter(s => s.id !== id));
      showToast("Toko berhasil dihapus");
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Data Toko & SPBU</h2>
          <p className="text-sm text-gray-500">Kelola identitas, mode usaha, dan format toko Anda</p>
        </div>
        <Button onClick={() => handleEditInit('new')}><Plus size={18}/> Tambah Data Baru</Button>
      </div>

      {editingId && (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h3 className="font-bold text-lg mb-4 text-gray-800">{editingId === 'new' ? 'Tambah Data Baru' : 'Edit Data'}</h3>
          
          <div className="mb-4 bg-gray-50 p-3 rounded-md border inline-flex gap-4">
             <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
               <input type="radio" name="storeType" checked={editingType === 'retail'} onChange={() => setEditingType('retail')} className="text-blue-600"/>
               Toko Retail (Kasir Umum)
             </label>
             <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
               <input type="radio" name="storeType" checked={editingType === 'spbu'} onChange={() => setEditingType('spbu')} className="text-red-600"/>
               SPBU / Pom Bensin
             </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input name="name" label="Nama Instansi/Toko" required defaultValue={stores.find(s=>s.id===editingId)?.name} />
            <Input name="phone" label="No. Telepon" required defaultValue={stores.find(s=>s.id===editingId)?.phone} />
            
            {editingType === 'spbu' && (
               <Input name="spbuNumber" label="Nomor SPBU (Opsional)" placeholder="Contoh: 54.681.01" defaultValue={stores.find(s=>s.id===editingId)?.spbuNumber} />
            )}
            
            <div className={`col-span-1 ${editingType === 'spbu' ? 'md:col-span-1' : 'md:col-span-2'}`}>
               <Input name="address1" label="Alamat Utama" required defaultValue={stores.find(s=>s.id===editingId)?.address1} />
            </div>

            {/* FORM TAMBAHAN YANG SEBELUMNYA HILANG */}
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
               <div>
                 <Input name="logoUrl" label="URL Logo (Link Gambar - Opsional)" placeholder="Contoh: https://link-gambar.com/logo.png" defaultValue={stores.find(s=>s.id===editingId)?.logoUrl} />
                 <p className="text-[10px] text-gray-500 -mt-2 mb-2">Kosongkan jika tidak memakai logo.</p>
               </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Bawah / Footer Struk (Opsional)</label>
                 <textarea name="footerText" className="w-full border rounded-md px-3 py-2 text-sm" rows={2} placeholder="Contoh: TERIMA KASIH ATAS KUNJUNGAN ANDA" defaultValue={stores.find(s=>s.id===editingId)?.footerText}></textarea>
               </div>
            </div>

            {editingType === 'spbu' && (
              <>
                <div className="col-span-1 md:col-span-2 bg-red-50 p-4 rounded border border-red-100 mb-2">
                   <h4 className="font-bold text-sm text-red-800 mb-2">Pengaturan Data Khusus SPBU</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                       <label className="block text-xs font-semibold text-gray-700 mb-1">Daftar Produk & Harga BBM</label>
                       <p className="text-[10px] text-gray-500 mb-1">Format: <b>NAMA:HARGA</b> (pisahkan dengan koma)</p>
                       <textarea name="spbuProducts" className="w-full border rounded-md px-3 py-2 text-sm font-mono border-gray-300" rows={3} placeholder="PERTAMAX:16250, PERTALITE:10000, BIOSOLAR:6800" defaultValue={stores.find(s=>s.id===editingId)?.spbuProducts || "PERTAMAX:16250, PERTALITE:10000, BIOSOLAR:6800"}></textarea>
                     </div>
                     <div>
                       <label className="block text-xs font-semibold text-gray-700 mb-1">Daftar Nama Operator (Kasir)</label>
                       <p className="text-[10px] text-gray-500 mb-1">Pisahkan dengan tanda koma (,)</p>
                       <textarea name="spbuOperators" className="w-full border rounded-md px-3 py-2 text-sm border-gray-300" rows={3} placeholder="Joko, Antika, Suciwati" defaultValue={stores.find(s=>s.id===editingId)?.spbuOperators}></textarea>
                     </div>
                   </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Template Struk</label>
              <select name="templateId" required defaultValue={stores.find(s=>s.id===editingId)?.templateId || templates[0].id} className="w-full px-3 py-2 border rounded-md text-sm">
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            
            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Font Struk (Monospace)</label>
               <select name="fontFamily" defaultValue={stores.find(s=>s.id===editingId)?.fontFamily || "'Courier New', Courier, monospace"} className="w-full px-3 py-2 border rounded-md text-sm">
                 <option value="'Courier New', Courier, monospace">Default (Courier New)</option>
                 <option value="'Space Mono', monospace">Space Mono (Keren/Rapi)</option>
                 <option value="'Fira Code', monospace">Fira Code (Modern Coding)</option>
                 <option value="'Inconsolata', monospace">Inconsolata (Tipis/Elegan)</option>
                 <option value="'VT323', monospace">VT323 (Retro/Pixel/Kasir Lama)</option>
               </select>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Batal</Button>
            <Button type="submit"><Save size={16}/> Simpan Data</Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stores.map(s => (
          <div key={s.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg text-gray-800">{s.name}</h3>
              <p className="text-gray-600 text-sm">{s.address1}</p>
              <p className="text-gray-500 text-xs mt-1">Telp: {s.phone}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`text-xs px-2 py-1 rounded border font-medium ${s.storeType === 'spbu' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                  {s.storeType === 'spbu' ? 'SPBU' : 'RETAIL'}
                </span>
                <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded border border-gray-200 font-medium">
                  Template: {templates.find(t=>t.id===s.templateId)?.name || 'Default'}
                </span>
              </div>
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
              <Button variant="outline" className="flex-1" onClick={() => handleEditInit(s.id)}><Edit size={14}/> Edit</Button>
              <Button variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => deleteStore(s.id)}><Trash2 size={14}/></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TemplatesView = () => {
  const { templates } = useAppContext();
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Template Struk</h2>
      <div className="bg-blue-50 text-blue-800 p-4 rounded-md border border-blue-200 mb-6 flex gap-3">
         <AlertCircle size={24} className="shrink-0"/>
         <p className="text-sm">Fitur Editor Drag & Drop Template sedang disempurnakan. Saat ini Anda dapat menggunakan variasi template siap pakai di bawah ini yang telah disesuaikan secara khusus untuk lebar kertas thermal 57mm.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <div key={t.id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 text-lg">{t.name}</h3>
            <p className="text-sm text-gray-500 mb-4 capitalize">Tipe: {t.type}</p>
            <ul className="text-sm text-gray-700 space-y-1 bg-gray-50 p-3 rounded border">
              <li><strong>Tampilkan Logo:</strong> {t.showLogo ? 'Ya' : 'Tidak'}</li>
              <li><strong>Tampilkan Kasir:</strong> {t.showCashier ? 'Ya' : 'Tidak'}</li>
              <li><strong>Posisi Header:</strong> {t.alignCenter ? 'Rata Tengah' : 'Rata Kiri'}</li>
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

const SettingsView = () => {
  const { settings, setSettings, showToast } = useAppContext();
  
  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSettings({
      ...settings,
      receiptPrefix: fd.get('receiptPrefix') as string,
      receiptDigits: Number(fd.get('receiptDigits')),
      receiptMode: fd.get('receiptMode') as 'random'|'sequential',
      dateMode: fd.get('dateMode') as 'auto'|'manual'
    });
    showToast("Pengaturan aplikasi berhasil disimpan");
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Pengaturan Aplikasi</h2>
      <form onSubmit={handleSave} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">Penomoran Struk</h3>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Input name="receiptPrefix" label="Prefix / Awalan" defaultValue={settings.receiptPrefix} />
          <Input name="receiptDigits" label="Jumlah Digit Angka" type="number" defaultValue={settings.receiptDigits} />
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Mode Penomoran</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="receiptMode" value="random" defaultChecked={settings.receiptMode === 'random'} /> Acak (Random)</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="receiptMode" value="sequential" defaultChecked={settings.receiptMode === 'sequential'} /> Berurutan (Sequential)</label>
            </div>
          </div>
        </div>

        <h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">Pengaturan Waktu Default</h3>
        <div className="mb-6">
           <label className="block text-sm font-medium text-gray-700 mb-2">Mode Waktu di Form Kasir</label>
           <div className="flex gap-4">
             <label className="flex items-center gap-2 text-sm"><input type="radio" name="dateMode" value="auto" defaultChecked={settings.dateMode === 'auto'} /> Otomatis Ikut Komputer</label>
             <label className="flex items-center gap-2 text-sm"><input type="radio" name="dateMode" value="manual" defaultChecked={settings.dateMode === 'manual'} /> Set Manual Setiap Transaksi</label>
           </div>
        </div>

        <Button type="submit" className="w-full"><Save size={16}/> Simpan Pengaturan</Button>
      </form>
    </div>
  );
};

const HistoryView = () => {
  const { transactions, triggerPrint } = useAppContext();
  
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Riwayat Transaksi</h2>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Tanggal / Waktu</th>
              <th className="px-4 py-3">No. Resi</th>
              <th className="px-4 py-3">Kasir / Opr</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Belum ada riwayat transaksi</td></tr>}
            {transactions.map(tx => (
              <tr key={tx.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">{formatDateToLocale(tx.date)} <span className="text-gray-400">{tx.time}</span></td>
                <td className="px-4 py-3 font-mono text-xs">{tx.receiptNo}</td>
                <td className="px-4 py-3">{tx.cashierName}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-700">Rp {tx.total.toLocaleString('id-ID')}</td>
                <td className="px-4 py-3 text-center">
                  <Button variant="secondary" onClick={() => triggerPrint(tx)} className="text-xs py-1 px-2"><Printer size={14}/> Cetak Ulang</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const BackupView = () => {
  const handleExport = () => {
    const data = {
      stores: JSON.parse(localStorage.getItem('stores') || '[]'),
      templates: JSON.parse(localStorage.getItem('templates') || '[]'),
      settings: JSON.parse(localStorage.getItem('settings') || '{}'),
      transactions: JSON.parse(localStorage.getItem('transactions') || '[]'),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-pos-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Backup & Restore Data</h2>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 max-w-lg">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Database size={24}/></div>
          <div>
            <h3 className="font-bold text-gray-800">Export Data Lokal</h3>
            <p className="text-sm text-gray-500">Unduh semua data (Toko, Transaksi, Pengaturan) ke format .json</p>
          </div>
        </div>
        <Button onClick={handleExport} className="w-full"><Save size={16}/> Download Backup</Button>
      </div>
    </div>
  );
};

// --- APP LAYOUT ---
const AppContent = () => {
  const [activeTab, setActiveTab] = useState('pos');
  const { printData } = useAppContext();

  // Mode cetak: sembunyikan semua UI lain, hanya tampilkan struk
  if (printData) {
    return (
      <div id="print-root">
        <ReceiptRenderer transaction={printData} isPrintMode={true} />
      </div>
    );
  }

  const TABS = [
    { id: 'pos', label: 'Kasir / POS', icon: <Store size={18}/> },
    { id: 'stores', label: 'Data Toko', icon: <Database size={18}/> },
    { id: 'templates', label: 'Template Struk', icon: <FileText size={18}/> },
    { id: 'history', label: 'Riwayat Cetak', icon: <History size={18}/> },
    { id: 'settings', label: 'Pengaturan', icon: <Settings size={18}/> },
    { id: 'backup', label: 'Backup Data', icon: <Save size={18}/> },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* SIDEBAR */}
      <div className="w-64 bg-gray-900 text-gray-300 flex flex-col no-print">
        <div className="p-4 bg-gray-950">
          <h1 className="text-xl font-bold text-white flex items-center gap-2"><Printer/> Thermal POS</h1>
          <p className="text-xs text-gray-500 mt-1">Version 1.0 - 57mm Edition</p>
        </div>
        
        <nav className="flex-1 px-2 py-4 space-y-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 hover:text-white'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden no-print">
        <main className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'pos' && <PosView />}
          {activeTab === 'stores' && <StoresView />}
          {activeTab === 'templates' && <TemplatesView />}
          {activeTab === 'history' && <HistoryView />}
          {activeTab === 'settings' && <SettingsView />}
          {activeTab === 'backup' && <BackupView />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}