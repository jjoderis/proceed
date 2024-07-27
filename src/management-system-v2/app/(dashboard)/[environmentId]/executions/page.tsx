import Content from '@/components/content';
import { getCurrentEnvironment } from '@/components/auth';
import { notFound } from 'next/navigation';
import DeploymentsView from './deployments-view';
import { getRootFolder, getFolderById, getFolderContent } from '@/lib/data/legacy/folders';
import { getUsersFavourites } from '@/lib/data/users';

const ExecutionsPage = async ({ params }: { params: { environmentId: string } }) => {
  if (!process.env.ENABLE_EXECUTION) {
    return notFound();
  }

  const { ability, activeEnvironment } = await getCurrentEnvironment(params.environmentId);

  const favs = await getUsersFavourites();

  const rootFolder = getRootFolder(activeEnvironment.spaceId, ability);

  const folder = getFolderById(rootFolder.id);

  const folderContents = await getFolderContent(folder.id, ability);

  return (
    <Content title="Executions">
      <DeploymentsView
        processes={folderContents}
        folder={folder}
        favourites={favs as string[]}
      ></DeploymentsView>
    </Content>
  );
};

export default ExecutionsPage;
