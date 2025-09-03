import { NextResponse } from 'next/server';
import { getModelOptions, getDefaultModel, getEnvironment } from '@/lib/ollama';

export async function GET() {
  try {
    const models = getModelOptions();
    const defaultModel = getDefaultModel();
    const environment = getEnvironment();
    
    return NextResponse.json({
      models,
      defaultModel,
      environment,
      success: true
    });
  } catch (error) {
    console.error('[/api/models] 모델 옵션 조회 실패:', error);
    return NextResponse.json(
      { 
        error: '모델 옵션을 불러올 수 없습니다',
        details: error.message
      },
      { status: 500 }
    );
  }
}