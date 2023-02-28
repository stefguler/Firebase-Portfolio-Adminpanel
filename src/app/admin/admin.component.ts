import { NavigationService } from './../services/navigation.service';
import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Project } from '../models/project';
import { ViewChild } from '@angular/core';
import { Subscription } from 'rxjs/internal/Subscription';
import { ProjectRequestsService } from '../services/project-requests.service';

import { AngularFireStorage } from '@angular/fire/compat/storage';
import 'firebase/compat/storage';
import { forkJoin, Observable, of, } from 'rxjs';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  title = 'Admin Panel';
  allProjects: Project[] = [];
  isFetching: boolean = false;
  @ViewChild('projectForm') form: NgForm;
  editMode: boolean = false;
  currentProjectId: string;
  errorMessage: string = null;
  errorSub: Subscription;

  preImgFile: File | null = null;
  postImgFile: File | null = null;
  preImgUrl: string | null = null;
  postImgUrl: string | null = null;
  preImageSrc: string | undefined;
  postImageSrc: string | undefined;
  preImgChange: boolean = false;
  postImgChange: boolean = false;
  preImgNameDelete: string;
  postImgNameDelete: string;
  preImgDeleted: boolean = false;
  postImgDeleted: boolean = false;



  constructor(private projectRequestService: ProjectRequestsService,
    private navigationService: NavigationService,
    private storage: AngularFireStorage) {
  }

  ngOnInit() {
    this.fetchProjects();
    this.errorSub = this.projectRequestService.error.subscribe((msg) => {
      this.errorMessage = msg;
    })

  }

  onProjectCreateOrUpdate(projectFormValue: {
    id: string;
    date: Date;
    object: string;
    model: string;
    title: string;
    description: string;
    technique: string;
    colors: string[];
    price: string;
    imgPreName: string;
    imgPreSrc: string;
    imgPostName: string;
    imgPostSrc: string;
    altText: string;
  }) {

    const projectData = { ...projectFormValue };
    const projectImagePaths = {};
    const storageRef = this.storage.ref('project-images');

    console.log(' this preImgFile in submit: ', this.preImgFile)
    const imageUploadPromises = [];
 
    // Upload pre-image
    if (this.preImgFile) {
      console.log('pre image triggered')
      const preImageName = this.preImgUrl
      const preImagePath = `pre/${preImageName}`;
      const preImageRef = storageRef.child(preImagePath);
      const preImageTask = preImageRef.put(this.preImgFile!);
      projectImagePaths['imgPreName'] = preImagePath;
      imageUploadPromises.push(preImageTask);
      // delete the current pre image if it exists
      if (projectFormValue.imgPostSrc) {
        const preImageToDelete = this.storage.ref(`project-images/${this.preImgNameDelete}`);
        preImageToDelete.delete().subscribe();
      }
    }
    
          // Upload post-image
      if (this.postImgFile) {
        console.log('post image triggered')
        const postImageName = this.postImgUrl
        const postImagePath = `post/${postImageName}`;
        const postImageRef = storageRef.child(postImagePath);
        const postImageTask = postImageRef.put(this.postImgFile!);
        projectImagePaths['imgPostName'] = postImagePath;
        imageUploadPromises.push(postImageTask);
        // delete the current post image if it exists
        if (projectFormValue.imgPostSrc) {
          const postImageToDelete = this.storage.ref(`project-images/${this.postImgNameDelete}`);
          postImageToDelete.delete().subscribe();
        }
      }
    

    // create alt Text
    const altText = `
      ${projectData.title}: 
      Ein ${projectData.model} 
      ${projectData.object} nach dem 
      Einsatz von ${projectData.technique}`

    projectData['altText'] = altText;

    // Initialize the request variable
    let request: Observable<any>;

    // Wait for both image uploads to complete
    
    Promise.all(imageUploadPromises)
      .then(() => {
        console.log('prmise triggered')
        // Add the image paths to the project data
        Object.assign(projectData, projectImagePaths);

        // create or update the project in the database
        let downloadPreImage$: Observable<string> = of(null);
        let downloadPostImage$: Observable<string> = of(null);
        // const downloadPreImage$ = this.storage.ref(`project-images/${projectData.imgPreName}`).getDownloadURL();
        // const downloadPostImage$ = this.storage.ref(`project-images/${projectData.imgPostName}`).getDownloadURL();

        if (projectData.imgPreName) {
          downloadPreImage$ = this.storage.ref(`project-images/${projectData.imgPreName}`).getDownloadURL();
        }
        if (projectData.imgPostName) {
          downloadPostImage$ = this.storage.ref(`project-images/${projectData.imgPostName}`).getDownloadURL();
        }

        forkJoin([downloadPreImage$, downloadPostImage$]).subscribe((urls: string[]) => {
          projectData.imgPreSrc = urls[0];
          projectData.imgPostSrc = urls[1];

          (this.editMode) ? request = this.projectRequestService.updateProject(this.currentProjectId, projectData) :
            request = this.projectRequestService.createProject(projectData);
          // console.log('request', request);

          // Subscribe to the request to update the allProjects array
          request.subscribe((response: any) => {
            if (this.editMode) {
              // Find the project in the allProjects array and update it
              const index = this.allProjects.findIndex(project => project.id === this.currentProjectId);
              this.allProjects[index] = response;
            } else {
              // Add the new project to the beginning of the allProjects array
              this.allProjects.unshift(response);
            }
            // Reset the form
            this.resetPageData();
          });
        });
      })
  }



  // FETCH / GET using a http request service

  private fetchProjects() {
    this.isFetching = true;
    this.projectRequestService.fetchProjects().subscribe((response) => {
      this.allProjects = response;
      this.isFetching = false;
    }, (err) => {
      this.errorMessage = err.message
    })
  }

  onFetchProjects() {
    this.fetchProjects();
  }


  //DELETE using a http request service
  // onDeleteProject(id: string) {
  //   this.projectRequestService.deleteProject(id);
  // }

  onDeleteProject(id: string) {
    this.projectRequestService.deleteProject(id).subscribe(() => {
      this.projectRequestService.fetchProjects().subscribe((projects: Project[]) => {
        this.allProjects = projects;
      });
    });
  }

  onDeleteAllProjects() {
    this.projectRequestService.deleteAllProjects().subscribe(() => {
      this.projectRequestService.fetchProjects().subscribe((projects: Project[]) => {
        this.allProjects = projects;
      });
    });
  }

  //old way
  // onDeleteAllProjects() {
  //   this.projectRequestService.deleteAllProjects();
  // }

  // UPDATE using a http request service

  onEditClicked(id: string) {
    this.currentProjectId = id;
    // get the product
    let currentProject = this.allProjects.find((project) => {
      return project.id === id
    })

    this.preImageSrc = currentProject.imgPreSrc
    this.postImageSrc = currentProject.imgPostSrc

    //fill the form with product details
    this.form.setValue({
      title: currentProject.title,
      date: currentProject.date,
      object: currentProject.object,
      model: currentProject.model,
      description: currentProject.description,
      technique: currentProject.technique,
      colors: currentProject.colors,
      price: currentProject.price,
      imgPreName: (currentProject.imgPreName === undefined) ? '' : currentProject.imgPreName,
      imgPreSrc: (currentProject.imgPreSrc === undefined) ? '' : currentProject.imgPreSrc,
      imgPostName: (currentProject.imgPostName === undefined) ? '' : currentProject.imgPostName,
      imgPostSrc: (currentProject.imgPostSrc === undefined) ? '' : currentProject.imgPostSrc,
    });

    //change value from "Add Product" - button to "Update Product" Button
    this.editMode = true;

  }

  onCancelEditMode() {
    this.editMode = false;
    this.resetPageData()

  }

  navigate(adress: string) {
    this.navigationService.navigateTo(adress)
  }

  //always have to save the picture in a File before I can use it and on submit send it
  onPreImageChange(event: any) {
    console.log(' this onPreImgChange before upload: ', this.preImgFile)

    this.preImgFile = event.target.files[0];
    console.log(this.preImgFile)

    if (this.preImgFile != undefined) {
      this.loadPreImage();
      this.preImgUrl = `${new Date().getTime()}_${this.preImgFile?.name}`;
      console.log('this.postImgUrl', this.preImgUrl);
      this.preImgNameDelete = this.form.value.imgPreName
      this.form.controls['imgPreName'].setValue(this.preImgUrl);
      this.preImgChange = true;
      console.log(' this onPreImgChange after upload, value was not undefined: ', this.preImgFile)

    } else {
      this.preImgUrl = undefined
      this.preImageSrc = undefined
      this.form.controls['imgPreName'].setValue('')
      console.log(' this onPreImgChange after upload, value was undefined: ', this.preImgFile)
    }
  }

  //always have to save the picture in a File before I can use it and on submit send it
  onPostImageChange(event: any) {
    this.postImgFile = event.target.files[0];

    if (this.postImgFile != undefined) {
      this.loadPostImage();
      this.postImgUrl = `${new Date().getTime()}_${this.postImgFile?.name}`;
      console.log('this.postImgUrl', this.postImgUrl);
      this.postImgNameDelete = this.form.value.imgPostName;
      this.form.controls['imgPostName'].setValue(this.postImgUrl);
      this.preImgChange = true;
    } else {
      this.postImgUrl = undefined
      this.postImageSrc = undefined
      this.form.controls['imgPostName'].setValue('')
    }
  }

  loadPreImage() {
    const reader = new FileReader();
    reader.onload = (event: any) => {
      this.preImageSrc = event.target.result;
    };
    reader.readAsDataURL(this.preImgFile);
  }

  loadPostImage() {
    const reader = new FileReader();
    reader.onload = (event: any) => {
      this.postImageSrc = event.target.result;
    };
    reader.readAsDataURL(this.postImgFile);
  }

  resetPageData() {
    this.form.reset();
    this.editMode = false;
    this.preImageSrc = "";
    this.postImageSrc = "";
    this.preImgFile = null;
    this.postImgFile = null;
    this.preImgUrl = null;
    this.postImgUrl = null;
  }

}

