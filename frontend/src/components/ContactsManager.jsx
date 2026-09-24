import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { PageLayout, GlassCard } from './SharedLayout';
import { LiquidMetalBorder, LiquidMetalButton } from './ui/LiquidMetal';
import { API_BASE } from '../config';

export function ContactsManager() {
  const [contacts, setContacts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    email: '',
    firebase_token: '',
    priority: 1,
    active: true
  });

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/contacts`);
      setContacts(response.data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        priority: parseInt(formData.priority)
      };

      if (editingContact) {
        await axios.put(`${API_BASE}/api/contacts/${editingContact.id}`, payload);
      } else {
        await axios.post(`${API_BASE}/api/contacts`, payload);
      }
      
      fetchContacts();
      resetForm();
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Failed to save contact: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      phone_number: contact.phone_number,
      email: contact.email || '',
      firebase_token: contact.firebase_token || '',
      priority: contact.priority,
      active: contact.active
    });
    setShowForm(true);
  };

  const handleDelete = async (contactId) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    
    try {
      await axios.delete(`${API_BASE}/api/contacts/${contactId}`);
      fetchContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete contact');
    }
  };

  const toggleActive = async (contact) => {
    try {
      await axios.put(`${API_BASE}/api/contacts/${contact.id}`, {
        ...contact,
        active: !contact.active
      });
      fetchContacts();
    } catch (error) {
      console.error('Error toggling contact status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone_number: '',
      email: '',
      firebase_token: '',
      priority: 1,
      active: true
    });
    setEditingContact(null);
    setShowForm(false);
  };

  const filteredContacts = (Array.isArray(contacts) ? contacts : []).filter(contact => {
    if (!contact) return false;
    const q = searchQuery.toLowerCase();
    const nameStr = (contact.name || '').toString().toLowerCase();
    const emailStr = (contact.email || '').toString().toLowerCase();
    const phoneStr = (contact.phone_number || '').toString().toLowerCase();
    return nameStr.includes(q) || emailStr.includes(q) || phoneStr.includes(q);
  });

  const stats = {
    total: Array.isArray(contacts) ? contacts.length : 0,
    active: (Array.isArray(contacts) ? contacts : []).filter(c => c?.active).length,
    priority1: (Array.isArray(contacts) ? contacts : []).filter(c => c?.priority === 1).length,
    standby: (Array.isArray(contacts) ? contacts : []).filter(c => !c?.active).length,
  };

  return (
    <PageLayout 
      title="Contact Management" 
      subtitle="Manage your team members and notification preferences"
    >
      <div className="space-y-6">
      {/* Header with Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex justify-end items-start mb-6">
          <LiquidMetalButton
            onClick={() => setShowForm(true)}
            size="md"
            borderWidth={4}
            icon={
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Add Contact
          </LiquidMetalButton>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <LiquidMetalBorder
            borderWidth={3}
            borderRadius="rounded-2xl"
            innerClassName="p-4 bg-neutral-950/80 backdrop-blur-xl"
            className="hover:-translate-y-1 transition-transform"
          >
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs font-semibold text-white/50">Total Contacts</div>
          </LiquidMetalBorder>

          <LiquidMetalBorder
            borderWidth={3}
            borderRadius="rounded-2xl"
            innerClassName="p-4 bg-neutral-950/80 backdrop-blur-xl"
            className="hover:-translate-y-1 transition-transform"
          >
            <div className="text-2xl font-bold text-emerald-400">{stats.active}</div>
            <div className="text-xs font-semibold text-white/50">Active Responders</div>
          </LiquidMetalBorder>

          <LiquidMetalBorder
            borderWidth={3}
            borderRadius="rounded-2xl"
            innerClassName="p-4 bg-neutral-950/80 backdrop-blur-xl"
            className="hover:-translate-y-1 transition-transform"
          >
            <div className="text-2xl font-bold text-white">{stats.priority1}</div>
            <div className="text-xs font-semibold text-white/50">Priority 1 (Primary)</div>
          </LiquidMetalBorder>

          <LiquidMetalBorder
            borderWidth={3}
            borderRadius="rounded-2xl"
            innerClassName="p-4 bg-neutral-950/80 backdrop-blur-xl"
            className="hover:-translate-y-1 transition-transform"
          >
            <div className="text-2xl font-bold text-neutral-400">{stats.standby}</div>
            <div className="text-xs font-semibold text-white/50">Standby / Inactive</div>
          </LiquidMetalBorder>
        </div>
      </motion.div>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="relative"
      >
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search contacts by name, phone number, or email..."
          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/20 text-white rounded-xl focus:border-white focus:ring-1 focus:ring-white transition-all placeholder:text-white/30"
        />
      </motion.div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                resetForm();
              }
            }}
          >
            <div
              className="bg-neutral-900 border border-white/20 p-8 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold mb-6 text-white">
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-white">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2 border border-white/20 rounded-lg focus:border-white focus:ring-1 focus:ring-white bg-white/5 text-white transition-all placeholder:text-white/30"
                      placeholder="e.g., Sarah Jenkins"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-white">
                      Phone Number (Twilio Alert Destination) *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone_number}
                      onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                      className="w-full px-4 py-2 border border-white/20 rounded-lg focus:border-white focus:ring-1 focus:ring-white bg-white/5 text-white transition-all placeholder:text-white/30"
                      placeholder="+919876543210"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-white">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone_number}
                      onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                      className="w-full px-4 py-2 border border-white/20 rounded-lg focus:border-white focus:ring-1 focus:ring-white bg-white/5 text-white transition-all placeholder:text-white/30"
                      placeholder="+1234567890"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-white">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-2 border border-white/20 rounded-lg focus:border-white focus:ring-1 focus:ring-white bg-white/5 text-white transition-all placeholder:text-white/30"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-white">
                    Priority: {formData.priority} {formData.priority === 1 ? '(Highest)' : ''}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                  <div className="flex justify-between text-xs text-white/50 mt-1">
                    <span>1 - Highest</span>
                    <span>5 - Lowest</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 p-4 bg-white/5 border border-white/10 rounded-lg">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData({...formData, active: e.target.checked})}
                    className="w-5 h-5 rounded border-white/30 text-white focus:ring-white/50 bg-black"
                  />
                  <label htmlFor="active" className="text-sm font-semibold text-white">
                    Active (receives alert notifications)
                  </label>
                </div>

                <div className="flex space-x-3 pt-4">
                  <LiquidMetalButton
                    type="submit"
                    size="md"
                    borderWidth={4}
                    className="flex-1"
                  >
                    {editingContact ? 'Update Contact' : 'Create Contact'}
                  </LiquidMetalButton>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 bg-transparent border border-white/20 text-white rounded-full font-semibold hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contacts Grid */}
      <GlassCard className="p-8 relative overflow-hidden">
        {/* inner glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-[90px]" />
        
        <div className="relative z-10">
          <div className="mb-10 flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">
                Directory
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">
                Team Members
              </h2>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredContacts.map((contact, idx) => (
              <LiquidMetalBorder
                key={contact.id || idx}
                borderWidth={3}
                borderRadius="rounded-[2rem]"
                innerClassName={`p-6 ${
                  contact.active
                    ? 'bg-neutral-950/90'
                    : 'bg-neutral-950/60 opacity-80'
                }`}
                className="hover:-translate-y-2 transition-transform duration-300"
              >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-white opacity-[0.03] rounded-full blur-2xl`}></div>
            
            {/* Header */}
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl font-bold shadow-lg text-white`}>
                  {contact.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-xl text-white">{contact.name}</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    contact.priority === 1
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-white/10 text-white/70 border border-white/20'
                  } mt-1`}>
                    {contact.priority === 1 ? 'Priority 1 (Primary)' : `Priority ${contact.priority}`}
                  </span>
                </div>
              </div>
              <motion.button
                onClick={() => toggleActive(contact)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                  contact.active
                    ? 'bg-green-500/20 text-green-300 border-green-500/30'
                    : 'bg-white/10 text-white/50 border-white/20'
                }`}
              >
                {contact.active ? '✓' : '✗'}
              </motion.button>
            </div>

            {/* Info */}
            <div className="space-y-2 mb-4 relative z-10">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <span className="opacity-50">Phone:</span>
                <span className="font-mono">{contact.phone_number}</span>
              </div>
              {contact.email && (
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <span className="opacity-50">Email:</span>
                  <span className="truncate">{contact.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-white/60">
                <span className="opacity-50">Priority:</span>
                <span className="font-semibold">{contact.priority}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 relative z-10">
              <button
                onClick={() => handleEdit(contact)}
                className="flex-1 py-2 bg-white/10 text-white border border-white/20 rounded-lg font-semibold text-sm shadow-md hover:bg-white/20 transition-all"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(contact.id)}
                className="flex-1 py-2 bg-transparent text-white/70 border border-white/10 hover:border-white/30 hover:text-white rounded-lg font-semibold text-sm transition-all"
              >
                Delete
              </button>
            </div>
          </LiquidMetalBorder>
        ))}
      </motion.div>
      </div>
    </GlassCard>

      {/* Empty State */}
      {filteredContacts.length === 0 && (
        <GlassCard className="p-12 text-center mt-8">
          <h3 className="text-2xl font-bold text-white mb-2">
            No contacts found
          </h3>
          <p className="text-white/50 mb-6">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Get started by adding your first contact'}
          </p>
          {!searchQuery && (
            <motion.button
              onClick={() => setShowForm(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white text-black px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all"
            >
              Add Your First Contact
            </motion.button>
          )}
        </GlassCard>
      )}
      </div>
    </PageLayout>
  );
}

export default ContactsManager;
