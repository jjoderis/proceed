'use client';
import ForgotPassword from '@/components/forgot-password';
import { useRouter, usePathname } from 'next/navigation';
import { FC } from 'react';
import style from './auth.module.scss';
import { Space, theme } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { Spin } from 'antd';

const antIcon = <LoadingOutlined style={{ fontSize: 24 }} spin />;

const ForgotPasswordPage: FC = () => {
  // const router = useRouter();
  // const activeSegment = usePathname().split('/')[1] || 'auth';

  // router.push('/auth/login');

  // const {
  //   token: { colorBgContainer },
  // } = theme.useToken();

  return <ForgotPassword />;
};

export default ForgotPasswordPage;
