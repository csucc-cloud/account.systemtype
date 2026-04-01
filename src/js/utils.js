export const utils = {
    formatPHP: (num) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(num),
    formatDate: (str) => new Date(str).toLocaleDateString('en-PH')
};
