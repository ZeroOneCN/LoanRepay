import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          fontSize: 14,
          controlHeight: 36,
          colorBgContainer: '#ffffff',
          colorBgLayout: '#f5f5f5',
          colorBorderSecondary: '#f0f0f0',
        },
        components: {
          Card: {
            paddingLG: 16,
            paddingSM: 12,
          },
          Table: {
            headerBg: '#fafafa',
            headerColor: '#1a1a1a',
          },
          Menu: {
            itemBg: 'transparent',
            itemSelectedBg: '#e6f4ff',
          },
          Statistic: {
            contentFontSize: 24,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
