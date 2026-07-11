const loginCard=document.getElementById('loginCard');
const account=document.getElementById('account');
const loginForm=document.getElementById('loginForm');
const loginBtn=document.getElementById('loginBtn');
const loginMessage=document.getElementById('loginMessage');
const accountMessage=document.getElementById('accountMessage');
const mobileInput=document.getElementById('mobile');
const ordersContainer=document.getElementById('orders');
const emptyState=document.getElementById('emptyState');
const logoutBtn=document.getElementById('logoutBtn');
const money=new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0});
const progressSteps=['Order Confirmed','Processing','Printed','Shipped','Delivered'];

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function setMessage(element,text,type=''){element.textContent=text;element.className=`message ${type}`.trim();}
async function request(path,options={}){const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Request failed.');return data;}
function completedStep(status){if(status==='Cancelled')return 0;if(status==='Out for Delivery')return 4;const index=progressSteps.indexOf(status);return index<0?0:index;}
function renderCustomer(customer){document.getElementById('customerName').textContent=customer.name||'Customer';document.getElementById('customerMobile').textContent=customer.mobile?`+91 ${customer.mobile}`:'';const orders=Array.isArray(customer.orders)?customer.orders:[];ordersContainer.innerHTML=orders.map(order=>{const done=completedStep(order.status);const steps=progressSteps.map((step,index)=>`<div class="step ${index<=done?'done':''}">${escapeHtml(step)}</div>`).join('');const button=order.trackingUrl?`<a class="track-button" href="${escapeHtml(order.trackingUrl)}" target="_blank" rel="noopener noreferrer">Open Live ${escapeHtml(order.carrier||'Carrier')} Tracking</a>`:'<span class="track-button disabled">Live tracking link will appear after shipment</span>';return `<article class="order-card"><div class="order-top"><div><h3>${escapeHtml(order.orderReference)}</h3><div class="order-date">Updated ${order.updatedAt?new Date(order.updatedAt).toLocaleString('en-IN'):'recently'}</div></div><span class="amount">${money.format(order.amount||0)}</span></div><div class="order-content"><div class="product">${escapeHtml(order.productSummary)}</div><div class="tracking-meta"><div><span>Current status</span><strong>${escapeHtml(order.status||'Order Confirmed')}</strong></div><div><span>${escapeHtml(order.carrier||'Shipping partner')} tracking number</span><strong>${escapeHtml(order.trackingNumber||'Not assigned yet')}</strong></div></div><div class="status-track">${steps}</div>${button}</div></article>`;}).join('');emptyState.classList.toggle('hidden',orders.length>0);loginCard.classList.add('hidden');account.classList.remove('hidden');}
async function checkSession(){try{const data=await request('/api/tracking/session');if(data.authenticated)renderCustomer(data.customer);}catch(error){setMessage(loginMessage,error.message,'error');}}
mobileInput.addEventListener('input',()=>{mobileInput.value=mobileInput.value.replace(/\D/g,'').slice(0,10);});
loginForm.addEventListener('submit',async event=>{event.preventDefault();loginBtn.disabled=true;setMessage(loginMessage,'Checking your account...');try{const data=await request('/api/tracking/login',{method:'POST',body:JSON.stringify({mobile:mobileInput.value,password:document.getElementById('password').value})});renderCustomer(data.customer);loginForm.reset();setMessage(accountMessage,'Tracking information loaded.','success');}catch(error){setMessage(loginMessage,error.message,'error');}finally{loginBtn.disabled=false;}});
logoutBtn.addEventListener('click',async()=>{try{await request('/api/tracking/logout',{method:'POST',body:'{}'});}catch{}account.classList.add('hidden');loginCard.classList.remove('hidden');ordersContainer.innerHTML='';setMessage(loginMessage,'You have been logged out.');});
checkSession();
