let cart = [];
let total = 0;

// Coupon state
let appliedCoupon = null; // { code, discount_amount, ... } once validated by the server
let payableTotal = 0;     // total minus any applied coupon discount

// Set once a Razorpay payment is verified by the server (see payNow()).
let currentPaymentVerified = false;
let currentRazorpayOrderId = null;
let currentRazorpayPaymentId = null;

/* ===================== MENU CARD QTY (+/-) ===================== */

// The menu cards show a small quantity number next to each item
// (id="qty-<Item Name>"). Because some ids in the markup replace
// spaces with dashes and some don't, we look for both forms and
// update every match (a couple of item names appear on more than
// one card, e.g. "Dosa" in both Morning and Night).
function getQtyElements(name){

    let idPlain = "qty-" + name;
    let idDashed = "qty-" + name.replace(/\s+/g, "-");

    let selector = "#" + CSS.escape(idPlain);

    if(idDashed !== idPlain){
        selector += ", #" + CSS.escape(idDashed);
    }

    return document.querySelectorAll(selector);
}

function updateQtyDisplay(name){

    let count = cart.filter(c => c.item === name).length;

    getQtyElements(name).forEach(el => {
        el.innerText = count;
    });

}

function resetAllQtyDisplays(){

    document.querySelectorAll('[id^="qty-"]').forEach(el => {
        el.innerText = "0";
    });

}

function increaseQtyByName(name, price){

    cart.push({ item: name, price: price });

    updateCart();
    updateQtyDisplay(name);

}

function decreaseQtyByName(name, price){

    // Remove the most recently added unit of this item, if any is in the cart.
    let idx = -1;

    for(let i = cart.length - 1; i >= 0; i--){
        if(cart[i].item === name){
            idx = i;
            break;
        }
    }

    if(idx === -1){
        return;
    }

    cart.splice(idx, 1);

    updateCart();
    updateQtyDisplay(name);

}

function addToCart(item, price){

    cart.push({
        item,
        price
    });

    total += price;

    updateCart();
    updateQtyDisplay(item);

    alert(item + " added to cart");

}

function updateCart(){

    let cartItems =
    document.getElementById("cart-items");

    cartItems.innerHTML = "";

    total = 0;

    cart.forEach((item,index)=>{

        total += item.price;

        let li =
        document.createElement("li");

        li.innerHTML = `

        <div class="cart-item">

            <div>

                <h4>${item.item}</h4>

                <p>₹${item.price}</p>

            </div>

            <div class="cart-buttons">

                <button onclick="increaseQty(${index})">
                    +
                </button>

                <button onclick="decreaseQty(${index})">
                    -
                </button>

                <button onclick="removeItem(${index})">
                    🗑
                </button>

            </div>

        </div>

        `;

        cartItems.appendChild(li);

    });

    document.getElementById("total").innerText = total;

    document.getElementById("cart-count").innerText = cart.length;

    if(cart.length === 0 && appliedCoupon){
        // Coupon no longer makes sense against an empty cart
        appliedCoupon = null;
        let msgEl = document.getElementById("coupon-message");
        if(msgEl){
            msgEl.innerText = "";
            msgEl.className = "coupon-message";
        }
    }

    updatePayableTotal();

    // QR Amount Auto Update
    let qrBox = document.getElementById("qr-box");

    if(qrBox && qrBox.style.display === "block"){

        document.getElementById("qr-amount").innerText = payableTotal;

        document.getElementById("qrcode").innerHTML = "";

        let upiLink =
        `upi://pay?pa=9080149926@paytm&pn=GOWTHAM MESS&am=${payableTotal}&cu=INR`;

        new QRCode(
            document.getElementById("qrcode"),
            {
                text: upiLink,
                width: 250,
                height: 250
            }
        );
    }

}

/* ===================== COUPONS ===================== */

async function applyCoupon(){

    let codeInput = document.getElementById("coupon-code");
    let msgEl = document.getElementById("coupon-message");
    let code = codeInput ? codeInput.value.trim() : "";

    if(!code){
        msgEl.innerText = "Enter a coupon code.";
        msgEl.className = "coupon-message error";
        return;
    }

    if(cart.length === 0){
        msgEl.innerText = "Add items to your cart first.";
        msgEl.className = "coupon-message error";
        return;
    }

    try{

        let res = await fetch("/api/coupons/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, subtotal: total })
        });

        let data = await res.json();

        if(!res.ok || !data.valid){
            appliedCoupon = null;
            msgEl.innerText = data.error || "Invalid coupon code.";
            msgEl.className = "coupon-message error";
            updatePayableTotal();
            return;
        }

        appliedCoupon = data;

        msgEl.innerText = `✅ "${data.code}" applied — you saved ₹${data.discount_amount}`;
        msgEl.className = "coupon-message success";

        updatePayableTotal();

    } catch(err){
        console.error("Apply coupon error:", err);
        appliedCoupon = null;
        msgEl.innerText = "Could not validate coupon. Please try again.";
        msgEl.className = "coupon-message error";
        updatePayableTotal();
    }

}

function removeCoupon(){

    appliedCoupon = null;

    let codeInput = document.getElementById("coupon-code");
    let msgEl = document.getElementById("coupon-message");

    if(codeInput) codeInput.value = "";
    if(msgEl){
        msgEl.innerText = "";
        msgEl.className = "coupon-message";
    }

    updatePayableTotal();

}

function updatePayableTotal(){

    let discountRow = document.getElementById("discount-row");

    if(appliedCoupon && appliedCoupon.valid){

        let discount = appliedCoupon.discount_amount;
        if(discount > total) discount = total;

        payableTotal = Math.round((total - discount) * 100) / 100;

        let labelEl = document.getElementById("discount-code-label");
        let amountEl = document.getElementById("discount-amount");

        if(labelEl) labelEl.innerText = appliedCoupon.code;
        if(amountEl) amountEl.innerText = discount;
        if(discountRow) discountRow.style.display = "flex";

    } else {

        payableTotal = total;
        if(discountRow) discountRow.style.display = "none";

    }

    let payableEl = document.getElementById("payable-total");
    if(payableEl) payableEl.innerText = payableTotal;

}

function toggleCart(){

    document.getElementById("cart").classList.toggle("active");

}

function checkout(){

    if(cart.length === 0){

        alert("Cart is Empty");
        return;

    }

    let customerName = document.getElementById("name").value;
    let phone = document.getElementById("phone").value;
    let deliveryType = document.getElementById("deliveryType").value;
    let address = document.getElementById("address").value;

    let billMessage = `🍴 GOWTHAM MESS BILL %0A%0A`;

    billMessage += `Customer: ${customerName}%0A`;
    billMessage += `Phone: ${phone}%0A`;
    billMessage += `Delivery: ${deliveryType}%0A`;
    billMessage += `Address/Table: ${address}%0A%0A`;

    billMessage += `🛒 Ordered Items:%0A`;

    cart.forEach((item)=>{

        billMessage += `- ${item.item} : ₹${item.price}%0A`;

    });

    billMessage += `%0A💰 Total Amount: ₹${total}`;

    // YOUR WHATSAPP NUMBER
    let whatsappNumber = "919080149926";

    // OPEN WHATSAPP
    window.open(
        `https://wa.me/${whatsappNumber}?text=${billMessage}`,
        "_blank"
    );

}


function showBill(){

    if(cart.length === 0){

        alert("Cart is Empty");
        return;

    }

    let customerName =
    document.getElementById("name").value;

    document.getElementById("bill-customer").innerText =
    customerName;
    document.getElementById("bill-order-no").textContent = generateOrderNumber();

    let today = new Date();

    let day = String(today.getDate()).padStart(2, '0');
    let month = String(today.getMonth() + 1).padStart(2, '0');
    let year = today.getFullYear();

    document.getElementById("bill-date").innerText =
    `${day}/${month}/${year}`;

    let billItems =
    document.getElementById("bill-items");

    billItems.innerHTML = "";

    let groupedItems = {};

    cart.forEach((item)=>{

        if(groupedItems[item.item]){

            groupedItems[item.item].qty += 1;
            groupedItems[item.item].price += item.price;

        }else{

            groupedItems[item.item] = {
                qty:1,
                price:item.price
            };

        }

    });

    for(let itemName in groupedItems){

        let row = document.createElement("tr");

        row.innerHTML = `
            <td>${itemName}</td>
            <td>${groupedItems[itemName].qty}</td>
            <td>₹${groupedItems[itemName].price}</td>
        `;

        billItems.appendChild(row);

    }

    document.getElementById("bill-total").innerText =
    total;

    /* PAYMENT METHOD */

    let paymentMethod =
    document.querySelector(
    'input[name="payment"]:checked'
    ).value;

    let transactionId =
    document.getElementById("transaction-id").value;

    /* CREATE PAYMENT ROW */

    let paymentRow =
    document.createElement("tr");

    paymentRow.innerHTML = `
    <td colspan="3">
    <b>Payment:</b> ${paymentMethod}
    <br>
    <b>Transaction ID:</b>
    ${transactionId || "Cash Payment"}
    </td>
    `;

    billItems.appendChild(paymentRow);

    document.getElementById("bill-popup").style.display =
    "flex";

}

function closeBill(){

    document.getElementById("bill-popup").style.display = "none";

    // Show Call & WhatsApp buttons again
    let floatingIcons = document.querySelector(".floating-icons");
    if(floatingIcons) floatingIcons.style.display = "flex";

}

function printBill(){

    // Hide buttons before printing
    let floatingIcons = document.querySelector(".floating-icons");
    if(floatingIcons) floatingIcons.style.display = "none";

    window.print();

    // Show buttons after printing
    if(floatingIcons) floatingIcons.style.display = "flex";

}

function placeOrder(){

    try{

        const nameField = document.getElementById("name");
        const name = nameField ? nameField.value.trim() : "";

        if(!name){
            alert("Please enter your name first.");
            return;
        }

        alert("Thank You " + name + " save your delivery details");

    } catch(err){
        console.error("placeOrder error:", err);
    }

}

function scrollMenu(){

    document.getElementById("menu").scrollIntoView({
        behavior:"smooth"
    });

}

function sendEmail(){

    if (cart.length === 0) {
        alert("Cart is Empty!");
        return;
    }

    let customerName = document.getElementById("name").value;

    let email = prompt("Enter Email Address");

    if(email == "" || email == null){

        return;

    }

    let subject = "GOWTHAM MESS BILL";

    let body = `Customer: ${customerName}\n\n`;

    cart.forEach((item)=>{

        body += `${item.item} - ₹${item.price}\n`;

    });

    body += `\nTotal Amount: ₹${total}`;

    window.location.href =
    `mailto:${email}?subject=${subject}&body=${body}`;

}

/* ===================== MENU CATEGORY / SEARCH ===================== */

function showMenu(menuId){

    document.querySelectorAll(".menu-box").forEach(menu => {
        menu.style.display = "none";
    });

    document.getElementById(menuId).style.display = "block";

    document.getElementById(menuId).scrollIntoView({
        behavior:"smooth"
    });

}

function showAllMenu(){

    document.querySelectorAll(".menu-box").forEach(menu => {
        menu.style.display = "block";
    });

    document.getElementById("menu").scrollIntoView({
        behavior:"smooth"
    });

}

function searchMenu(){

    let input =
    document.getElementById("searchInput")
    .value.toLowerCase().trim();

    document.querySelectorAll(".menu-box")
    .forEach(menu => {

        menu.style.display = "block";

    });

    document.querySelectorAll(".card")
    .forEach(card => {

        let titleEl = card.querySelector("h4");
        let name = titleEl ? titleEl.innerText.toLowerCase() : "";

        card.style.display =
        name.includes(input)
        ? "block"
        : "none";

    });

    // Nothing typed — go back to the collapsed (no category open) view
    if(input === ""){
        document.querySelectorAll(".menu-box").forEach(menu => {
            menu.style.display = "none";
        });
    }

}

/* ===================== AUTH SYSTEM ===================== */

let currentProfileUser = null; // cached profile of the logged-in user

function showAuthTab(tab){

    let loginForm = document.getElementById("login-form");
    let signupForm = document.getElementById("signup-form");
    let loginTabBtn = document.getElementById("tab-login-btn");
    let signupTabBtn = document.getElementById("tab-signup-btn");

    if(tab === "signup"){
        loginForm.style.display = "none";
        signupForm.style.display = "block";
        loginTabBtn.classList.remove("active");
        signupTabBtn.classList.add("active");
    } else {
        signupForm.style.display = "none";
        loginForm.style.display = "block";
        signupTabBtn.classList.remove("active");
        loginTabBtn.classList.add("active");
    }

}

function showAuthError(elId, message){
    let el = document.getElementById(elId);
    if(!el) return;
    el.innerText = message;
    el.classList.add("show");
}

function clearAuthError(elId){
    let el = document.getElementById(elId);
    if(!el) return;
    el.innerText = "";
    el.classList.remove("show");
}

function applyLoggedInUI(user){

    currentProfileUser = user;

    document.getElementById("login-popup").style.display = "none";
    document.getElementById("user-name").innerText = user.full_name;
    document.getElementById("floating-icons").style.display = "flex";

    localStorage.setItem("gowthamUser", user.full_name);

}

async function checkAuthOnLoad(){

    let token = localStorage.getItem("gm_token");

    if(!token){
        return; // gate stays visible, showing Login/Sign Up
    }

    try{

        let res = await fetch("/api/auth/me", {
            headers: { "Authorization": "Bearer " + token }
        });

        if(!res.ok){
            localStorage.removeItem("gm_token");
            return;
        }

        let data = await res.json();
        applyLoggedInUI(data.user);

    } catch(err){
        console.error("Auth check error:", err);
    }

}

async function signupUser(){

    clearAuthError("signup-error");

    let full_name = document.getElementById("signup-fullname").value.trim();
    let email = document.getElementById("signup-email").value.trim();
    let phone = document.getElementById("signup-phone").value.trim();
    let password = document.getElementById("signup-password").value;
    let confirm_password = document.getElementById("signup-confirm-password").value;

    if(!full_name || !email || !phone || !password || !confirm_password){
        showAuthError("signup-error", "Please fill in every field.");
        return;
    }

    if(password !== confirm_password){
        showAuthError("signup-error", "Passwords do not match.");
        return;
    }

    try{

        let res = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ full_name, email, phone, password, confirm_password })
        });

        let data = await res.json();

        if(!res.ok){
            showAuthError("signup-error", data.error || "Could not create account.");
            return;
        }

        localStorage.setItem("gm_token", data.token);
        applyLoggedInUI(data.user);

    } catch(err){
        console.error("Signup error:", err);
        showAuthError("signup-error", "Could not reach the server. Please try again.");
    }

}

async function loginUser(){

    clearAuthError("login-error");

    let identifier = document.getElementById("login-identifier").value.trim();
    let password = document.getElementById("login-password").value;

    if(!identifier || !password){
        showAuthError("login-error", "Please enter your email and password.");
        return;
    }

    try{

        let res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier, password })
        });

        let data = await res.json();

        if(!res.ok){
            showAuthError("login-error", data.error || "Invalid login.");
            return;
        }

        localStorage.setItem("gm_token", data.token);
        applyLoggedInUI(data.user);

    } catch(err){
        console.error("Login error:", err);
        showAuthError("login-error", "Could not reach the server. Please try again.");
    }

}

function logoutUser(){

    localStorage.removeItem("gm_token");
    localStorage.removeItem("gowthamUser");
    currentProfileUser = null;

    document.getElementById("floating-icons").style.display = "none";
    closeProfile();

    location.reload();

}

/* ===================== PROFILE MODAL ===================== */

function openProfile(){

    if(!currentProfileUser){
        return;
    }

    document.getElementById("profile-view-name").innerText = currentProfileUser.full_name;
    document.getElementById("profile-view-email").innerText = currentProfileUser.email;
    document.getElementById("profile-view-phone").innerText = currentProfileUser.phone;

    toggleEditProfile(false);
    toggleChangePassword(false);

    document.getElementById("profile-modal").classList.add("open");

}

function closeProfile(){
    document.getElementById("profile-modal").classList.remove("open");
}

function toggleEditProfile(show){

    document.getElementById("profile-view").style.display = show ? "none" : "block";
    document.getElementById("profile-edit").style.display = show ? "block" : "none";
    document.getElementById("profile-password").style.display = "none";

    clearAuthError("profile-edit-error");

    if(show && currentProfileUser){
        document.getElementById("edit-fullname").value = currentProfileUser.full_name;
        document.getElementById("edit-email").value = currentProfileUser.email;
        document.getElementById("edit-phone").value = currentProfileUser.phone;
    }

}

function toggleChangePassword(show){

    document.getElementById("profile-view").style.display = show ? "none" : "block";
    document.getElementById("profile-password").style.display = show ? "block" : "none";
    document.getElementById("profile-edit").style.display = "none";

    clearAuthError("profile-password-error");

    if(show){
        document.getElementById("current-password").value = "";
        document.getElementById("new-password").value = "";
        document.getElementById("confirm-new-password").value = "";
    }

}

async function saveProfile(){

    clearAuthError("profile-edit-error");

    let full_name = document.getElementById("edit-fullname").value.trim();
    let email = document.getElementById("edit-email").value.trim();
    let phone = document.getElementById("edit-phone").value.trim();

    if(!full_name || !email || !phone){
        showAuthError("profile-edit-error", "Please fill in every field.");
        return;
    }

    let token = localStorage.getItem("gm_token");

    try{

        let res = await fetch("/api/auth/profile", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ full_name, email, phone })
        });

        let data = await res.json();

        if(!res.ok){
            showAuthError("profile-edit-error", data.error || "Could not update profile.");
            return;
        }

        currentProfileUser = data.user;
        document.getElementById("user-name").innerText = data.user.full_name;
        localStorage.setItem("gowthamUser", data.user.full_name);

        document.getElementById("profile-view-name").innerText = data.user.full_name;
        document.getElementById("profile-view-email").innerText = data.user.email;
        document.getElementById("profile-view-phone").innerText = data.user.phone;

        toggleEditProfile(false);

    } catch(err){
        console.error("Save profile error:", err);
        showAuthError("profile-edit-error", "Could not reach the server. Please try again.");
    }

}

async function submitChangePassword(){

    clearAuthError("profile-password-error");

    let current_password = document.getElementById("current-password").value;
    let new_password = document.getElementById("new-password").value;
    let confirm_new_password = document.getElementById("confirm-new-password").value;

    if(!current_password || !new_password || !confirm_new_password){
        showAuthError("profile-password-error", "Please fill in every field.");
        return;
    }

    if(new_password !== confirm_new_password){
        showAuthError("profile-password-error", "New passwords do not match.");
        return;
    }

    let token = localStorage.getItem("gm_token");

    try{

        let res = await fetch("/api/auth/password", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ current_password, new_password, confirm_new_password })
        });

        let data = await res.json();

        if(!res.ok){
            showAuthError("profile-password-error", data.error || "Could not change password.");
            return;
        }

        alert("✅ Password changed successfully.");
        toggleChangePassword(false);

    } catch(err){
        console.error("Change password error:", err);
        showAuthError("profile-password-error", "Could not reach the server. Please try again.");
    }

}

/* SHOW QR (toggle) */

function showQR(){

    let qrBox = document.getElementById("qr-box");

    // Toggle QR Show/Hide
    if(qrBox.style.display === "block"){
        qrBox.style.display = "none";
        return;
    }

    qrBox.style.display = "block";

    // Show cart total (after any coupon discount)
    document.getElementById("qr-amount").innerText = payableTotal;

    // Clear old QR
    document.getElementById("qrcode").innerHTML = "";

    // Your UPI ID
    let upiLink =
    `upi://pay?pa=9080149926@paytm&pn=GOWTHAM MESS&am=${payableTotal}&cu=INR`;

    // Generate QR
    new QRCode(
        document.getElementById("qrcode"),
        {
            text: upiLink,
            width: 250,
            height: 250
        }
    );

}

/* PAYMENT SUCCESS (legacy popup, kept for compatibility) */

function paymentSuccess(){

    let popup = document.getElementById("payment-popup");
    if(popup) popup.style.display = "flex";

}

function closePaymentPopup(){

    let popup = document.getElementById("payment-popup");
    if(popup) popup.style.display = "none";

}

/* ===================== RAZORPAY (CARD) PAYMENT ===================== */

async function payNow(){

    if(cart.length === 0){

        alert("🛒 Please add items to cart first");
        return;
    }

    currentPaymentVerified = false;
    currentRazorpayOrderId = null;
    currentRazorpayPaymentId = null;

    let orderData;

    try{

        let res = await fetch("/api/payment/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: payableTotal })
        });

        orderData = await res.json();

        if(!res.ok){
            alert(orderData.error || "Could not start payment. Please try again.");
            return;
        }

    } catch(err){
        console.error("Create order error:", err);
        alert("Could not reach payment server. Please try again.");
        return;
    }

    let options = {

        key: orderData.key_id,

        amount: orderData.amount,

        currency: orderData.currency,

        order_id: orderData.order_id,

        name: "GOWTHAM MESS",

        description: "Food Order Payment",

        image: "logo.jpeg",

        handler: async function(response){

            try{

                let verifyRes = await fetch("/api/payment/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature
                    })
                });

                let verifyData = await verifyRes.json();

                if(verifyData.verified){

                    currentPaymentVerified = true;
                    currentRazorpayOrderId = response.razorpay_order_id;
                    currentRazorpayPaymentId = response.razorpay_payment_id;

                    let tx = document.getElementById("transaction-id");

                    if(tx){
                        tx.value = response.razorpay_payment_id;
                    }

                    alert(
                        "✅ Payment Verified\n\nTransaction ID:\n" +
                        response.razorpay_payment_id
                    );

                } else {

                    alert("⚠️ Payment could not be verified. Please contact us before confirming your order.");

                }

            } catch(err){
                console.error("Verify error:", err);
                alert("⚠️ Could not verify payment. Please contact us before confirming your order.");
            }

        },

        prefill: {

            name:
            document.getElementById("name").value,

            contact:
            document.getElementById("phone").value,

            email:
            document.getElementById("user_email") ?
            document.getElementById("user_email").value :
            ""

        },

        theme: {
            color: "#28a745"
        }

    };

    let rzp =
    new Razorpay(options);

    rzp.open();

}

/* PAYTM / GPAY / PHONEPE DEEP LINKS */

function payWithPaytm(){

    if(cart.length === 0){
        alert("Please add items to cart first.");
        return;
    }

    window.location.href =
    `paytmmp://pay?pa=9080149926@ptsbi&pn=GowthamMess&am=${payableTotal}&cu=INR`;
}

function payWithGpay(){

    if(cart.length === 0){
        alert("Please add items to cart first.");
        return;
    }

    window.location.href =
    `tez://upi/pay?pa=m.gowthammanimalan8383@oksbi&pn=GowthamMess&am=${payableTotal}&cu=INR`;
}

function payWithPhonepe(){

    if(cart.length === 0){
        alert("Please add items to cart first.");
        return;
    }

    window.location.href =
    `phonepe://pay?pa=9080149926@ybl&pn=GowthamMess&am=${payableTotal}&cu=INR`;
}

/* ===================== ORDER MENU SIDEBAR / POPUPS ===================== */

function toggleOrderMenu(){

    const menu = document.getElementById("order-menu");

    if(!menu){
        console.log("order-menu not found");
        return;
    }

    menu.style.display =
    menu.style.display === "block"
    ? "none"
    : "block";
}

function showOrderDetails() {

    document.getElementById("orderUser").innerText =
        document.getElementById("name").value || "Not Entered";

    document.getElementById("orderPhone").innerText =
        document.getElementById("phone").value || "Not Entered";

    document.getElementById("orderAddress").innerText =
        document.getElementById("address").value || "Not Entered";

    let orderItems = document.getElementById("orderItems");

    orderItems.innerHTML = "";

    cart.forEach(item => {

        orderItems.innerHTML += `
            <p>
                ${item.item} - ₹${item.price}
            </p>
        `;

    });

    document.getElementById("orderTotal").innerText = total;

    document.getElementById("orderDetailsPopup").style.display = "flex";
}

function showDeliveryStatus(){

    document.getElementById("deliveryStatusPopup")
    .style.display = "flex";
}

function showPaymentDetails(){

    let payment =
    document.querySelector(
    'input[name="payment"]:checked'
    ).value;

    document.getElementById("paymentUser").innerText =
    document.getElementById("name").value;

    document.getElementById("paymentTotal").innerText =
    total;

    document.getElementById("paymentMethod").innerText =
    payment;

    document.getElementById("paymentDetailsPopup")
    .style.display = "flex";
}

function closePopup(id){

    document.getElementById(id)
    .style.display = "none";
}

function showTracking(){

    document.getElementById(
        "trackingPopup"
    ).style.display = "flex";

}

function startTracking(){

    document.getElementById("track2")
    .classList.remove("active");

    document.getElementById("track3")
    .classList.remove("active");

    document.getElementById("track4")
    .classList.remove("active");

    setTimeout(function(){

        document.getElementById("track2")
        .classList.add("active");

    },3000);

    setTimeout(function(){

        document.getElementById("track3")
        .classList.add("active");

    },6000);

    setTimeout(function(){

        document.getElementById("track4")
        .classList.add("active");

        alert("🎉 Order Delivered");

    },9000);

}

/* ===================== CONFIRM ORDER (sends email + saves order) ===================== */

function confirmOrder() {

    if (cart.length === 0) {
        alert("🛒 Cart is Empty! Please add items.");
        return;
    }

    let customerName =
    document.getElementById("name").value;

    let phone =
    document.getElementById("phone").value;

    let email =
    document.getElementById("user_email").value;

    let address =
    document.getElementById("address").value;

    if (
        customerName === "" ||
        phone === "" ||
        email === "" ||
        address === ""
    ) {
        alert("🚚 Delivery Details are mandatory. Please fill all details.");
        return;
    }

    let orderTime =
    new Date().toLocaleString("en-IN", {
        dateStyle: "short",
        timeStyle: "medium"
    });

    let payment =
    document.querySelector(
        'input[name="payment"]:checked'
    );

    let paymentMethod =
    payment ? payment.value : "Cash";

    if(paymentMethod === "Online" && !currentPaymentVerified){
        alert("⚠️ Please complete card payment before confirming your order.");
        return;
    }

    let paymentStatus =
    paymentMethod === "Online" && currentPaymentVerified
    ? "Paid ✅"
    : "Pending";

    let orderItems = "";

    cart.forEach(item => {
        orderItems +=
        `${item.item} - ₹${item.price}\n`;
    });

    emailjs.send(
        "gowtham_mess",
        "template_y0au8ao",
        {
            name: customerName,
            phone: phone,
            email: email,
            address: address,
            time: orderTime,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            items: orderItems,
            total: payableTotal,
            coupon: appliedCoupon ? appliedCoupon.code : "None"
        }
    )

    .then(function(response){

        alert("Order Sent Successfully!");

        saveOrderToServer(
            customerName,
            phone,
            email,
            address,
            paymentMethod,
            paymentStatus
        );

        document.getElementById(
            "success-user"
        ).innerText =
        `Thank You ${customerName}`;

        document.getElementById(
            "order-success-popup"
        ).style.display = "flex";

    })

    .catch(function(error){

        console.log(error);

        alert("Email Failed");

    });

}

/* CLOSE SUCCESS POPUP + RESET EVERYTHING FOR THE NEXT ORDER */

function closeSuccessPopup(){

    document.getElementById(
        "order-success-popup"
    ).style.display = "none";

    /* CLEAR CART */

    cart = [];
    total = 0;

    updateCart();
    resetAllQtyDisplays();

    /* CLEAR BILL */

    document.getElementById(
        "bill-items"
    ).innerHTML = "";

    document.getElementById(
        "bill-total"
    ).innerText = "0";

    /* RESET QR */

    document.getElementById(
        "qr-amount"
    ).innerText = "0";

    document.getElementById(
        "transaction-id"
    ).value = "";

    document.getElementById(
        "qr-box"
    ).style.display = "none";

    /* RESET PAYMENT VERIFICATION STATE */

    currentPaymentVerified = false;
    currentRazorpayOrderId = null;
    currentRazorpayPaymentId = null;

    /* RESET COUPON STATE */

    removeCoupon();

    /* CLOSE CART PROPERLY */

    document.getElementById(
        "cart"
    ).classList.remove("active");

    /* RESET FORM */

    document.getElementById("name").value = "";
    document.getElementById("phone").value = "";
    document.getElementById("address").value = "";

    /* READY FOR NEXT CUSTOMER */

    alert("Ready For New Order 🍴");

}

/* ===================== CART SIDEBAR ROW CONTROLS ===================== */

function removeItem(index){

    let item = cart[index];

    cart.splice(index,1);

    updateCart();

    if(item) updateQtyDisplay(item.item);

}

function increaseQty(index){

    let item = cart[index];

    cart.push({
        item:item.item,
        price:item.price
    });

    updateCart();
    updateQtyDisplay(item.item);

}

function decreaseQty(index){

    let item = cart[index];

    cart.splice(index,1);

    updateCart();

    if(item) updateQtyDisplay(item.item);

}

/* GROUP CART ITEMS FOR SAVING */

function buildOrderItems(){

    let grouped = {};

    cart.forEach(item=>{

        if(grouped[item.item]){
            grouped[item.item].qty += 1;
        } else {
            grouped[item.item] = {
                item: item.item,
                price: item.price,
                qty: 1
            };
        }

    });

    return Object.values(grouped);
}

/* SAVE ORDER TO SERVER (MySQL) */

async function saveOrderToServer(customerName, phone, email, address, paymentMethod, paymentStatus){

    let deliveryType = document.getElementById("deliveryType").value;

    let transactionId =
    document.getElementById("transaction-id") ?
    document.getElementById("transaction-id").value :
    "";

    try{

        let res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                customer_name: customerName,
                phone: phone,
                email: email,
                delivery_type: deliveryType,
                address: address,
                items: buildOrderItems(),
                subtotal: total,
                coupon_code: appliedCoupon ? appliedCoupon.code : null,
                discount_amount: appliedCoupon ? appliedCoupon.discount_amount : 0,
                total: payableTotal,
                payment_method: paymentMethod,
                payment_status: paymentStatus,
                razorpay_order_id: currentRazorpayOrderId,
                razorpay_payment_id: currentRazorpayPaymentId || transactionId || null
            })
        });

        let data = await res.json();

        if(!res.ok){
            console.error("Order save failed:", data.error);
        }

    } catch(err){
        console.error("Order save error:", err);
    }

}

function generateOrderNumber() {

    const today = new Date().toISOString().split("T")[0];

    let savedDate = localStorage.getItem("orderDate");
    let orderNo = parseInt(localStorage.getItem("orderNo")) || 0;

    if (savedDate !== today) {
        orderNo = 0;
        localStorage.setItem("orderDate", today);
    }

    orderNo++;

    localStorage.setItem("orderNo", orderNo);

    return String(orderNo).padStart(3, "0");
}

/* ===================== FAVORITE (❤) BUTTONS ===================== */
/* Purely visual — toggles a highlighted heart. No onclick attribute is
   in the markup, so we wire these up here via event delegation. */

function initFavButtons(){

    document.querySelectorAll(".fav-btn").forEach(btn => {

        btn.addEventListener("click", function(){
            this.classList.toggle("favorited");
        });

    });

}

/* ===================== PAGE LOAD ===================== */

window.onload = function(){

    // Hide all menu categories until one is picked (or "All Food" / search)
    document.querySelectorAll(".menu-box").forEach(menu => {
        menu.style.display = "none";
    });

    resetAllQtyDisplays();
    initFavButtons();
    checkAuthOnLoad();

}

const hero = document.querySelector(".hero");

const backgrounds = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1920&q=80",
  "https://media.istockphoto.com/id/1279763992/photo/healthy-food-for-lower-cholesterol-and-heart-care-shot-on-wooden-table.webp?a=1&b=1&s=612x612&w=0&k=20&c=ujC9Sg4-ck6wYZZH_WJ3a7pGFy-IJR5IWLe_FhsGXeU=",
  "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGZvb2R8ZW58MHx8MHx8fDA%3D"
];
let index = 0;

function changeBackground() {
    hero.style.backgroundImage = `url('${backgrounds[index]}')`;
    index = (index + 1) % backgrounds.length;
}

changeBackground(); // First image
setInterval(changeBackground, 5000); // Change every 5 seconds