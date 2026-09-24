import type { GlobalConfig } from 'payload'

export const PaymentSettings: GlobalConfig = {
  slug: 'payment-settings',
  label: 'Payment Settings',
  admin: {
    group: 'Settings',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'activePaymentMethod',
      type: 'select',
      label: 'Active Mobile Payment Method',
      required: true,
      defaultValue: 'upi_direct',
      options: [
        {
          label: 'Direct UPI App (No Gateway)',
          value: 'upi_direct',
        },
        {
          label: 'HDFC SmartGateway (Cards, Netbanking, UPI)',
          value: 'hdfc_smartgateway',
        },
      ],
      admin: {
        description: 'Select which payment flow should be triggered when customers click BILL and select UPI/Online on their mobile phone.',
      },
    },
    {
      type: 'group',
      name: 'hdfcSettings',
      label: 'HDFC SmartGateway Configuration',
      admin: {
        condition: (data) => data.activePaymentMethod === 'hdfc_smartgateway',
      },
      fields: [
        {
          name: 'merchantId',
          type: 'text',
          label: 'Merchant ID (x-merchantid)',
          required: true,
        },
        {
          name: 'apiKeyBase64',
          type: 'text',
          label: 'Base64 Encoded API Key',
          required: true,
          admin: {
            description: 'The Base64 encoded API key used for Basic Auth.',
          },
        },
        {
          name: 'paymentPageClientId',
          type: 'text',
          label: 'Payment Page Client ID',
          required: true,
          defaultValue: 'hdfcmaster',
          admin: {
            description: 'For Sandbox use "hdfcmaster". For Production use your Merchant ID.',
          },
        },
        {
          name: 'environment',
          type: 'select',
          label: 'Environment',
          required: true,
          defaultValue: 'sandbox',
          options: [
            {
              label: 'Sandbox / UAT',
              value: 'sandbox',
            },
            {
              label: 'Production',
              value: 'production',
            },
          ],
        },
      ],
    },
  ],
}
