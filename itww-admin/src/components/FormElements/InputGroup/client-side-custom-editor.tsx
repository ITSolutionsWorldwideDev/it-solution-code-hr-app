// src/components/FormElements/InputGroup/client-side-custom-editor.tsx
'use client';
import dynamic from 'next/dynamic';

const ClientSideCustomEditor = dynamic(
  () => import('@/components/FormElements/InputGroup/ckeditor'),
  { ssr: false }
);

export default ClientSideCustomEditor;

