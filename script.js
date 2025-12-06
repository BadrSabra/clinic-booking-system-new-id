/**
 * عيادتي - نظام حجز المواعيد الطبية
 * النسخة: 1.0.0
 * التاريخ: 2025-12-06
 */

// ===== CONFIGURATION =====
const CONFIG = {
    clinicName: "عيادتي",
    clinicPhone: "+966501234567",
    clinicEmail: "info@myclinic.com",
    workingHours: {
        start: "08:00",
        end: "20:00"
    },
    booking: {
        minAdvanceHours: 24,
        maxAdvanceDays: 90
    }
};

// ===== DATA MODELS =====
class Doctor {
    constructor(id, name, specialty, experience, fee, image = null) {
        this.id = id;
        this.name = name;
        this.specialty = specialty;
        this.experience = experience;
        this.fee = fee;
        this.image = image;
    }
}

class Appointment {
    constructor(patientName, phone, date, time, doctorId = null, notes = '') {
        this.patientName = patientName;
        this.phone = phone;
        this.date = date;
        this.time = time;
        this.doctorId = doctorId;
        this.notes = notes;
        this.id = this.generateId();
        this.createdAt = new Date().toISOString();
        this.status = 'pending';
    }

    generateId() {
        return `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// ===== UTILITY FUNCTIONS =====
const Utils = {
    // تنسيق التاريخ
    formatDate(date) {
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Riyadh'
        };
        return new Intl.DateTimeFormat('ar-SA', options).format(date);
    },

    // تنسيق الوقت
    formatTime(time) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const suffix = hour >= 12 ? 'م' : 'ص';
        const formattedHour = hour % 12 || 12;
        return `${formattedHour}:${minutes} ${suffix}`;
    },

    // تنسيق العملة
    formatCurrency(amount) {
        return new Intl.NumberFormat('ar-SA', {
            style: 'currency',
            currency: 'SAR'
        }).format(amount);
    },

    // تنظيف المدخلات
    sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    },

    // التحقق من الاسم
    validateName(name) {
        if (!name || name.trim().length < 2 || name.trim().length > 50) {
            return {
                valid: false,
                message: 'الاسم يجب أن يكون بين ٢ و ٥٠ حرفاً'
            };
        }
        
        const arabicNameRegex = /^[\u0600-\u06FF\u0750-\u077F\s]+$/;
        if (!arabicNameRegex.test(name.trim())) {
            return {
                valid: false,
                message: 'الاسم يجب أن يكون باللغة العربية'
            };
        }
        
        return { valid: true, message: '' };
    },

    // التحقق من رقم الهاتف السعودي
    validatePhone(phone) {
        const saudiPhoneRegex = /^(05|5)(5|0|3|6|4|9|1|8|7)([0-9]{7})$/;
        if (!saudiPhoneRegex.test(phone)) {
            return {
                valid: false,
                message: 'رقم الهاتف غير صالح. مثال: 05XXXXXXXX'
            };
        }
        return { valid: true, message: '' };
    },

    // التحقق من التاريخ
    validateDate(date) {
        const selectedDate = new Date(date);
        const today = new Date();
        const minDate = new Date(today);
        minDate.setDate(today.getDate() + 1); // غداً
        
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + CONFIG.booking.maxAdvanceDays);

        if (selectedDate < minDate) {
            return {
                valid: false,
                message: 'يجب أن يكون التاريخ بعد اليوم'
            };
        }

        if (selectedDate > maxDate) {
            return {
                valid: false,
                message: `لا يمكن الحجز لأكثر من ${CONFIG.booking.maxAdvanceDays} يوم مقدماً`
            };
        }

        // التحقق من أيام العمل (الأحد إلى الخميس)
        const dayOfWeek = selectedDate.getDay();
        if (dayOfWeek === 5 || dayOfWeek === 6) { // الجمعة أو السبت
            return {
                valid: false,
                message: 'العيادة مغلقة يومي الجمعة والسبت'
            };
        }

        return { valid: true, message: '' };
    },

    // التحقق من الوقت
    validateTime(time) {
        const [hours, minutes] = time.split(':').map(Number);
        const [startHour] = CONFIG.workingHours.start.split(':').map(Number);
        const [endHour] = CONFIG.workingHours.end.split(':').map(Number);

        if (hours < startHour || hours > endHour) {
            return {
                valid: false,
                message: `ساعات العمل من ${CONFIG.workingHours.start} إلى ${CONFIG.workingHours.end}`
            };
        }

        if (minutes !== 0 && minutes !== 30) {
            return {
                valid: false,
                message: 'المواعيد تكون على الساعة أو النصف ساعة'
            };
        }

        return { valid: true, message: '' };
    }
};

// ===== APPLICATION STATE =====
const AppState = {
    doctors: [
        new Doctor(1, 'د. أحمد محمد', 'أمراض القلب', 15, 300),
        new Doctor(2, 'د. سارة عبدالله', 'طب النساء والتوليد', 12, 250),
        new Doctor(3, 'د. خالد سعيد', 'طب العظام', 10, 350),
        new Doctor(4, 'د. فاطمة ناصر', 'طب الأطفال', 8, 200),
        new Doctor(5, 'د. محمد حسن', 'طب العيون', 20, 400),
        new Doctor(6, 'د. ليلى أحمد', 'طب الجلدية', 7, 300)
    ],
    appointments: JSON.parse(localStorage.getItem('appointments') || '[]'),
    currentBooking: null
};

// ===== DOCTORS MANAGER =====
class DoctorsManager {
    constructor() {
        this.container = document.querySelector('.doctors-grid');
        this.init();
    }

    init() {
        this.renderDoctors();
    }

    renderDoctors() {
        if (!this.container) return;

        this.container.innerHTML = '';
        
        AppState.doctors.forEach(doctor => {
            const doctorCard = this.createDoctorCard(doctor);
            this.container.appendChild(doctorCard);
        });
    }

    createDoctorCard(doctor) {
        const card = document.createElement('article');
        card.className = 'doctor-card fade-in';
        card.setAttribute('role', 'article');
        card.setAttribute('aria-labelledby', `doctor-${doctor.id}-name`);

        const safeName = Utils.sanitizeInput(doctor.name);
        const safeSpecialty = Utils.sanitizeInput(doctor.specialty);
        const formattedFee = Utils.formatCurrency(doctor.fee);

        card.innerHTML = `
            <div class="doctor-image" role="img" aria-label="صورة الدكتور ${safeName}">
                <i class="fas fa-user-md" aria-hidden="true"></i>
            </div>
            <div class="doctor-info">
                <h3 id="doctor-${doctor.id}-name" class="doctor-name">${safeName}</h3>
                <p class="doctor-specialty">${safeSpecialty}</p>
                <p class="doctor-experience">خبرة ${doctor.experience} سنة</p>
                <p class="doctor-fee">${formattedFee}</p>
                <button class="book-doctor-btn" data-doctor-id="${doctor.id}" 
                        aria-label="حجز موعد مع الدكتور ${safeName}">
                    حجز موعد
                </button>
            </div>
        `;

        // إضافة حدث للحجز المباشر
        const bookBtn = card.querySelector('.book-doctor-btn');
        bookBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleDoctorBooking(doctor.id);
        });

        return card;
    }

    handleDoctorBooking(doctorId) {
        const bookingSection = document.getElementById('booking');
        if (bookingSection) {
            bookingSection.scrollIntoView({ behavior: 'smooth' });
            
            // يمكن هنا إضافة منطق لتحديد الطبيب في النموذج
            console.log(`Selected doctor: ${doctorId}`);
        }
    }
}

// ===== BOOKING MANAGER =====
class BookingManager {
    constructor() {
        this.form = document.getElementById('booking-form');
        this.submitBtn = document.getElementById('submit-btn');
        this.init();
    }

    init() {
        if (!this.form) return;

        this.setupFormValidation();
        this.setupDateInput();
        this.setupFormSubmit();
        this.setupRealTimeValidation();
    }

    setupFormValidation() {
        // إضافة أحداث التحقق للعناصر
        const inputs = this.form.querySelectorAll('input[required], textarea');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
        });
    }

    setupDateInput() {
        const dateInput = document.getElementById('appointment-date');
        if (!dateInput) return;

        // تعيين الحد الأدنى (غداً)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const minDate = tomorrow.toISOString().split('T')[0];
        dateInput.min = minDate;

        // تعيين الحد الأقصى (90 يوم)
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + CONFIG.booking.maxAdvanceDays);
        dateInput.max = maxDate.toISOString().split('T')[0];

        // تعيين التاريخ الافتراضي (غداً)
        dateInput.value = minDate;

        // تحديث الأوقات المتاحة عند تغيير التاريخ
        dateInput.addEventListener('change', () => this.updateTimeSlots());
    }

    updateTimeSlots() {
        const dateInput = document.getElementById('appointment-date');
        const timeInput = document.getElementById('appointment-time');
        
        if (!dateInput || !timeInput) return;

        const selectedDate = new Date(dateInput.value);
        const dayOfWeek = selectedDate.getDay();
        
        // إذا كان اليوم جمعة أو سبت
        if (dayOfWeek === 5 || dayOfWeek === 6) {
            timeInput.disabled = true;
            timeInput.value = '';
            this.showError('time-error', 'العيادة مغلقة يومي الجمعة والسبت');
        } else {
            timeInput.disabled = false;
            this.clearError('time-error');
            
            // تعيين وقت افتراضي (09:00)
            timeInput.value = '09:00';
        }
    }

    setupRealTimeValidation() {
        const nameInput = document.getElementById('full-name');
        const phoneInput = document.getElementById('phone-number');
        
        if (nameInput) {
            nameInput.addEventListener('input', () => {
                const validation = Utils.validateName(nameInput.value);
                if (nameInput.value) {
                    this.showError('name-error', validation.message);
                } else {
                    this.clearError('name-error');
                }
            });
        }
        
        if (phoneInput) {
            phoneInput.addEventListener('input', () => {
                const validation = Utils.validatePhone(phoneInput.value);
                if (phoneInput.value) {
                    this.showError('phone-error', validation.message);
                } else {
                    this.clearError('phone-error');
                }
            });
        }
    }

    validateField(field) {
        const fieldId = field.id;
        const value = field.value.trim();
        
        if (!value && field.required) {
            this.showError(`${fieldId}-error`, 'هذا الحقل مطلوب');
            return false;
        }
        
        let validation;
        switch (fieldId) {
            case 'full-name':
                validation = Utils.validateName(value);
                break;
            case 'phone-number':
                validation = Utils.validatePhone(value);
                break;
            case 'appointment-date':
                validation = Utils.validateDate(value);
                break;
            case 'appointment-time':
                validation = Utils.validateTime(value);
                break;
            default:
                validation = { valid: true, message: '' };
        }
        
        if (!validation.valid) {
            this.showError(`${fieldId}-error`, validation.message);
            return false;
        }
        
        this.clearError(`${fieldId}-error`);
        return true;
    }

    showError(fieldId, message) {
        const errorElement = document.getElementById(fieldId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.setAttribute('role', 'alert');
        }
    }

    clearError(fieldId) {
        const errorElement = document.getElementById(fieldId);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.removeAttribute('role');
        }
    }

    validateForm() {
        const requiredFields = this.form.querySelectorAll('[required]');
        let isValid = true;
        
        requiredFields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });
        
        return isValid;
    }

    collectFormData() {
        const formData = new FormData(this.form);
        return {
            patientName: Utils.sanitizeInput(formData.get('full-name')),
            phone: formData.get('phone-number'),
            date: formData.get('appointment-date'),
            time: formData.get('appointment-time'),
            notes: Utils.sanitizeInput(formData.get('notes') || ''),
            doctorId: null // يمكن تعديله ليدعم اختيار الطبيب
        };
    }

    async submitForm() {
        if (!this.validateForm()) {
            this.showNotification('يرجى تصحيح الأخطاء في النموذج', 'error');
            return false;
        }
        
        const formData = this.collectFormData();
        const appointment = new Appointment(
            formData.patientName,
            formData.phone,
            formData.date,
            formData.time,
            formData.doctorId,
            formData.notes
        );
        
        // محاكاة إرسال البيانات
        return new Promise((resolve) => {
            setTimeout(() => {
                // حفظ في localStorage
                AppState.appointments.push(appointment);
                localStorage.setItem('appointments', JSON.stringify(AppState.appointments));
                
                resolve(true);
            }, 1500);
        });
    }

    setupFormSubmit() {
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (this.submitBtn.disabled) return;
            
            this.setLoadingState(true);
            
            try {
                const success = await this.submitForm();
                
                if (success) {
                    this.showSuccessMessage();
                    this.resetForm();
                }
            } catch (error) {
                console.error('Booking error:', error);
                this.showNotification('حدث خطأ أثناء الحجز. يرجى المحاولة مرة أخرى.', 'error');
            } finally {
                this.setLoadingState(false);
            }
        });
    }

    setLoadingState(isLoading) {
        if (this.submitBtn) {
            this.submitBtn.disabled = isLoading;
            this.submitBtn.textContent = isLoading ? 'جاري الحجز...' : 'تأكيد الحجز';
            
            if (isLoading) {
                this.submitBtn.classList.add('loading');
            } else {
                this.submitBtn.classList.remove('loading');
            }
        }
    }

    showSuccessMessage() {
        const formData = this.collectFormData();
        const formattedDate = Utils.formatDate(new Date(formData.date));
        const formattedTime = Utils.formatTime(formData.time);
        
        const message = `
            <div style="text-align: right; direction: rtl;">
                <h3 style="color: #10b981;">تم الحجز بنجاح! ✅</h3>
                <p><strong>اسم المريض:</strong> ${formData.patientName}</p>
                <p><strong>رقم الهاتف:</strong> ${formData.phone}</p>
                <p><strong>تاريخ الموعد:</strong> ${formattedDate}</p>
                <p><strong>وقت الموعد:</strong> ${formattedTime}</p>
                <p style="margin-top: 1rem; color: #64748b;">
                    سيتم التواصل معك للتأكيد خلال 24 ساعة.
                </p>
            </div>
        `;
        
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        // إنشاء عنصر الإشعار
        const notification = document.createElement('div');
        notification.className = `notification ${type}-message`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'assertive');
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
                <div>${message}</div>
            </div>
            <button class="close-notification" aria-label="إغلاق الإشعار">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // إضافة الأنماط
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            right: 20px;
            max-width: 500px;
            margin: 0 auto;
            padding: 1rem;
            border-radius: 0.5rem;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 9999;
            display: flex;
            justify-content: space-between;
            align-items: center;
            animation: slideIn 0.3s ease-out;
        `;
        
        // إضافة زر الإغلاق
        const closeBtn = notification.querySelector('.close-notification');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });
        
        // إضافة للإطار
        document.body.appendChild(notification);
        
        // إزالة تلقائية بعد 10 ثوانٍ
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
    }

    resetForm() {
        this.form.reset();
        this.setupDateInput(); // إعادة تعيين التاريخ
        this.clearAllErrors();
    }

    clearAllErrors() {
        const errorElements = this.form.querySelectorAll('.error-message');
        errorElements.forEach(element => {
            element.textContent = '';
            element.removeAttribute('role');
        });
    }
}

// ===== MOBILE MENU MANAGER =====
class MobileMenuManager {
    constructor() {
        this.menuToggle = document.querySelector('.menu-toggle');
        this.navMenu = document.querySelector('.nav-menu');
        this.init();
    }

    init() {
        if (!this.menuToggle || !this.navMenu) return;
        
        this.setupEventListeners();
        this.handleResize();
    }

    setupEventListeners() {
        this.menuToggle.addEventListener('click', () => this.toggleMenu());
        
        // إغلاق القائمة عند النقر على رابط
        const navLinks = this.navMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => this.closeMenu());
        });
        
        // إغلاق القائمة عند النقر خارجها
        document.addEventListener('click', (e) => {
            if (!this.menuToggle.contains(e.target) && 
                !this.navMenu.contains(e.target) &&
                this.isMenuOpen()) {
                this.closeMenu();
            }
        });
        
        // إغلاق القائمة بالضغط على Esc
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isMenuOpen()) {
                this.closeMenu();
            }
        });
    }

    toggleMenu() {
        const isExpanded = this.menuToggle.getAttribute('aria-expanded') === 'true';
        
        if (isExpanded) {
            this.closeMenu();
        } else 