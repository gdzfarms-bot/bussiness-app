class GDFarmsApp {
    constructor() {
        this.userId = null;
        this.settings = {};
        this.items = [];
        this.analytics = {};
        this.backendUrl = 'YOUR_BACKEND_URL'; // Replace with your backend URL
        
        this.init();
    }

    async init() {
        await this.initializeUser();
        this.loadSettings();
        this.setupEventListeners();
        this.loadDashboard();
    }

    async initializeUser() {
        // Try to get existing user ID from localStorage
        let userId = localStorage.getItem('gd_farms_user_id');
        
        try {
            const response = await fetch(`${this.backendUrl}/api/user/init`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.userId = data.userId;
                localStorage.setItem('gd_farms_user_id', this.userId);
                document.getElementById('user-status').textContent = 'User ID: ' + this.userId.substring(0, 8) + '...';
            } else {
                throw new Error('Failed to initialize user');
            }
        } catch (error) {
            console.error('User initialization failed:', error);
            document.getElementById('user-status').textContent = 'Offline Mode';
        }
    }

    async loadSettings() {
        if (!this.userId) return;
        
        try {
            const response = await fetch(`${this.backendUrl}/api/settings/${this.userId}`);
            const data = await response.json();
            
            if (data.success) {
                this.settings = data.settings;
                this.applySettings();
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    applySettings() {
        // Apply app name
        if (this.settings.app_name) {
            document.getElementById('app-title').textContent = this.settings.app_name;
            document.title = this.settings.app_name + ' - Business Tracker';
        }
        
        // Apply currency and units to form fields
        if (this.settings.currency) {
            document.getElementById('currency').value = this.settings.currency;
        }
        
        if (this.settings.unit_preferences) {
            const units = this.settings.unit_preferences;
            if (units.weight) {
                document.getElementById('weight-unit').value = units.weight;
            }
            if (units.volume) {
                document.getElementById('volume-unit').value = units.volume;
            }
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Add item button
        document.getElementById('add-item-btn').addEventListener('click', () => {
            this.openItemModal();
        });

        // Item form
        document.getElementById('item-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveItem();
        });

        // Settings form
        document.getElementById('settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });

        // Goal form
        document.getElementById('goal-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.setGoal();
        });

        // Modal close
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('item-modal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        // Load tab-specific data
        switch(tabName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'items':
                this.loadItems();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
            case 'goals':
                this.loadGoals();
                break;
            case 'settings':
                this.loadSettingsPage();
                break;
        }
    }

    async loadDashboard() {
        await this.loadItems();
        await this.loadAnalytics();
        this.updateDashboard();
    }

    async loadItems() {
        if (!this.userId) return;
        
        try {
            const response = await fetch(`${this.backendUrl}/api/items/${this.userId}`);
            const data = await response.json();
            
            if (data.success) {
                this.items = data.items;
                this.displayItems();
            }
        } catch (error) {
            console.error('Failed to load items:', error);
        }
    }

    displayItems() {
        const container = document.getElementById('items-list');
        const recentContainer = document.getElementById('recent-items-list');
        
        if (this.items.length === 0) {
            container.innerHTML = '<p>No items added yet. Click "Add New Item" to get started.</p>';
            recentContainer.innerHTML = '<p>No recent items.</p>';
            return;
        }

        // Display all items
        container.innerHTML = this.items.map(item => `
            <div class="item-card">
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <div class="item-details">
                        <span>Quantity: ${item.quantity_value} ${item.quantity_unit}</span>
                        <span>Buy: ${this.formatCurrency(item.buying_price)}/${item.quantity_unit}</span>
                        <span>Sell: ${this.formatCurrency(item.selling_price)}/${item.quantity_unit}</span>
                        <span>Profit: ${this.formatCurrency((item.selling_price - item.buying_price) * item.quantity_value)}</span>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-edit" onclick="app.editItem(${item.id})">Edit</button>
                    <button class="btn btn-danger" onclick="app.deleteItem(${item.id})">Delete</button>
                </div>
            </div>
        `).join('');

        // Display recent items (last 5)
        const recentItems = this.items.slice(0, 5);
        recentContainer.innerHTML = recentItems.map(item => `
            <div class="item-card">
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <div class="item-details">
                        <span>${item.quantity_value} ${item.quantity_unit}</span>
                        <span>Profit: ${this.formatCurrency((item.selling_price - item.buying_price) * item.quantity_value)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async loadAnalytics() {
        if (!this.userId) return;
        
        try {
            const response = await fetch(`${this.backendUrl}/api/analytics/${this.userId}`);
            const data = await response.json();
            
            if (data.success) {
                this.analytics = data.analytics;
                this.displayAnalytics();
            }
        } catch (error) {
            console.error('Failed to load analytics:', error);
        }
    }

    displayAnalytics() {
        // Update dashboard stats
        document.getElementById('total-revenue').textContent = this.formatCurrency(this.analytics.totalRevenue || 0);
        document.getElementById('total-profit').textContent = this.formatCurrency(this.analytics.totalProfit || 0);
        document.getElementById('profit-margin').textContent = (this.analytics.profitMargin || 0) + '%';
        document.getElementById('total-items').textContent = this.analytics.totalItems || 0;

        // Display financial summary
        const financialSummary = document.getElementById('financial-summary');
        financialSummary.innerHTML = `
            <p>Total Investment: <strong>${this.formatCurrency(this.analytics.totalInvestment || 0)}</strong></p>
            <p>Total Revenue: <strong>${this.formatCurrency(this.analytics.totalRevenue || 0)}</strong></p>
            <p>Total Profit: <strong>${this.formatCurrency(this.analytics.totalProfit || 0)}</strong></p>
            <p>Profit Margin: <strong>${this.analytics.profitMargin || 0}%</strong></p>
        `;

        // Display top items
        const topItemsContainer = document.getElementById('top-items');
        if (this.analytics.topItems && this.analytics.topItems.length > 0) {
            topItemsContainer.innerHTML = this.analytics.topItems.map(item => `
                <div class="item-card">
                    <div class="item-info">
                        <h4>${item.name}</h4>
                        <div class="item-details">
                            <span>Profit: ${this.formatCurrency(item.profit)}</span>
                            <span>Margin: ${(((item.selling_price - item.buying_price) / item.buying_price) * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            topItemsContainer.innerHTML = '<p>No items to display.</p>';
        }
    }

    updateDashboard() {
        // This method updates the dashboard with current data
        this.displayItems();
        this.displayAnalytics();
    }

    openItemModal(item = null) {
        const modal = document.getElementById('item-modal');
        const title = document.getElementById('modal-title');
        const form = document.getElementById('item-form');
        
        if (item) {
            // Edit mode
            title.textContent = 'Edit Item';
            document.getElementById('item-id').value = item.id;
            document.getElementById('item-name').value = item.name;
            document.getElementById('quantity-value').value = item.quantity_value;
            document.getElementById('quantity-unit').value = item.quantity_unit;
            document.getElementById('buying-price').value = item.buying_price;
            document.getElementById('selling-price').value = item.selling_price;
        } else {
            // Add mode
            title.textContent = 'Add New Item';
            form.reset();
            document.getElementById('item-id').value = '';
        }
        
        modal.style.display = 'block';
    }

    closeModal() {
        document.getElementById('item-modal').style.display = 'none';
    }

    async saveItem() {
        if (!this.userId) {
            alert('Please wait for user initialization to complete.');
            return;
        }

        const formData = {
            userId: this.userId,
            name: document.getElementById('item-name').value,
            quantity_value: parseFloat(document.getElementById('quantity-value').value),
            quantity_unit: document.getElementById('quantity-unit').value,
            buying_price: parseFloat(document.getElementById('buying-price').value),
            selling_price: parseFloat(document.getElementById('selling-price').value)
        };

        const itemId = document.getElementById('item-id').value;
        const url = itemId ? 
            `${this.backendUrl}/api/items/${itemId}` : 
            `${this.backendUrl}/api/items`;
        
        const method = itemId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            
            if (data.success) {
                this.closeModal();
                this.loadDashboard();
                this.showMessage('Item saved successfully!', 'success');
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to save item:', error);
            this.showMessage('Failed to save item: ' + error.message, 'error');
        }
    }

    editItem(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (item) {
            this.openItemModal(item);
        }
    }

    async deleteItem(itemId) {
        if (!confirm('Are you sure you want to delete this item?')) {
            return;
        }

        if (!this.userId) return;

        try {
            const response = await fetch(`${this.backendUrl}/api/items/${itemId}/${this.userId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            
            if (data.success) {
                this.loadDashboard();
                this.showMessage('Item deleted successfully!', 'success');
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to delete item:', error);
            this.showMessage('Failed to delete item: ' + error.message, 'error');
        }
    }

    async saveSettings() {
        if (!this.userId) return;

        const formData = {
            currency: document.getElementById('currency').value,
            app_name: document.getElementById('app-name').value,
            unit_preferences: {
                weight: document.getElementById('weight-unit').value,
                volume: document.getElementById('volume-unit').value
            }
        };

        try {
            const response = await fetch(`${this.backendUrl}/api/settings/${this.userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            
            if (data.success) {
                this.settings = data.settings;
                this.applySettings();
                this.showMessage('Settings saved successfully!', 'success');
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showMessage('Failed to save settings: ' + error.message, 'error');
        }
    }

    loadSettingsPage() {
        // Populate settings form with current values
        document.getElementById('app-name').value = this.settings.app_name || 'GD Farms';
        document.getElementById('currency').value = this.settings.currency || 'USD';
        
        if (this.settings.unit_preferences) {
            document.getElementById('weight-unit').value = this.settings.unit_preferences.weight || 'kg';
            document.getElementById('volume-unit').value = this.settings.unit_preferences.volume || 'liters';
        }
    }

    async setGoal() {
        if (!this.userId) return;

        const formData = {
            userId: this.userId,
            target_revenue: parseFloat(document.getElementById('target-revenue').value),
            target_profit: parseFloat(document.getElementById('target-profit').value),
            deadline: document.getElementById('goal-deadline').value
        };

        try {
            const response = await fetch(`${this.backendUrl}/api/goals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            
            if (data.success) {
                document.getElementById('goal-form').reset();
                this.loadGoals();
                this.showMessage('Goal set successfully!', 'success');
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to set goal:', error);
            this.showMessage('Failed to set goal: ' + error.message, 'error');
        }
    }

    async loadGoals() {
        if (!this.userId) return;

        try {
            const response = await fetch(`${this.backendUrl}/api/goals/${this.userId}`);
            const data = await response.json();
            
            if (data.success) {
                this.displayCurrentGoal(data.goal);
            }
        } catch (error) {
            console.error('Failed to load goals:', error);
        }
    }

    displayCurrentGoal(goal) {
        const container = document.getElementById('current-goal');
        
        if (!goal) {
            container.innerHTML = '<p>No goal set yet. Set a goal to track your progress!</p>';
            return;
        }

        const deadline = new Date(goal.deadline).toLocaleDateString();
        const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));
        
        container.innerHTML = `
            <div class="goal-info">
                <p><strong>Target Revenue:</strong> ${this.formatCurrency(goal.target_revenue)}</p>
                <p><strong>Target Profit:</strong> ${this.formatCurrency(goal.target_profit)}</p>
                <p><strong>Deadline:</strong> ${deadline} (${daysLeft} days left)</p>
                <div class="goal-progress">
                    ${this.generateGoalSuggestions(goal)}
                </div>
            </div>
        `;
    }

    generateGoalSuggestions(goal) {
        const currentRevenue = this.analytics.totalRevenue || 0;
        const currentProfit = this.analytics.totalProfit || 0;
        const revenueNeeded = goal.target_revenue - currentRevenue;
        const profitNeeded = goal.target_profit - currentProfit;
        
        let suggestions = '<h4>Suggestions:</h4><ul>';
        
        if (revenueNeeded > 0) {
            suggestions += `<li>You need to generate ${this.formatCurrency(revenueNeeded)} more in revenue</li>`;
        }
        
        if (profitNeeded > 0) {
            suggestions += `<li>You need to make ${this.formatCurrency(profitNeeded)} more in profit</li>`;
        }
        
        if (this.analytics.topItems && this.analytics.topItems.length > 0) {
            const topItem = this.analytics.topItems[0];
            suggestions += `<li>Focus on selling more "${topItem.name}" - it's your most profitable item</li>`;
        }
        
        if (revenueNeeded <= 0 && profitNeeded <= 0) {
            suggestions += '<li>Congratulations! You have achieved your goals! Consider setting new targets.</li>';
        }
        
        suggestions += '</ul>';
        return suggestions;
    }

    formatCurrency(amount) {
        const currency = this.settings.currency || 'USD';
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        });
        
        return formatter.format(amount);
    }

    showMessage(message, type) {
        // Remove any existing messages
        const existingMessages = document.querySelectorAll('.success-message, .error-message');
        existingMessages.forEach(msg => msg.remove());
        
        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
        messageDiv.textContent = message;
        
        // Insert at the top of the main content
        const main = document.querySelector('.main');
        main.insertBefore(messageDiv, main.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 5000);
    }
}

// Initialize the app when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GDFarmsApp();
});
